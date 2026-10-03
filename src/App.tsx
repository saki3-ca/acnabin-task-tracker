import React, { useEffect, useMemo, useState } from 'react';
import { AdminPanel } from './components/admin/AdminPanel';
import { ForgotPasswordModal } from './components/auth/ForgotPasswordModal';
import { LoginForm } from './components/auth/LoginForm';
import { ResetPasswordForm } from './components/auth/ResetPasswordForm';
import { SignupForm } from './components/auth/SignupForm';
import { ClientGrid } from './components/clients/ClientGrid';
import { ProfileView } from './components/profile/ProfileView';
import { StatPills } from './components/dashboard/StatPills';
import { Header } from './components/layout/Header';
import { NavigationTabs, TabKey } from './components/layout/NavigationTabs';
import { CommentModal } from './components/tasks/CommentModal';
import { TaskFilterBar } from './components/tasks/TaskFilterBar';
import { TaskModal } from './components/tasks/TaskModal';
import { TaskTable } from './components/tasks/TaskTable';
import { Toast } from './components/ui/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TaskProvider, useTasks } from './context/TaskContext';
import { isNearDeadline, isOverdue } from './lib/dateUtils';
import { canEditTask } from './lib/permissions';
import { Task } from './types';
import { RequestTaskModal } from './components/tasks/RequestTaskModal';
import { TaskRequestsView } from './components/tasks/TaskRequestsView';
import { NotificationsView } from './components/notifications/NotificationsView';
import { NotificationProvider } from './context/NotificationContext';
import { CompletedTasksModal } from './components/tasks/CompletedTasksModal';
import { ManpowerView } from './components/manpower/ManpowerView';
import { InvoiceTracker } from './components/invoices/InvoiceTracker';
import { ProposalTracker } from './components/proposals/ProposalTracker';
import { UploadPanel } from './components/proposals/UploadPanel';

const MainApp: React.FC = () => {
  const { currentUser, isLoading: authLoading } = useAuth();
  const { myTasks, teamTasks, teamFilters, myStats, teamStats, isLoading: tasksLoading, toast } = useTasks();

  const [activeTab, setActiveTab] = useState<TabKey>('own');
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  // Password reset links from the reset email land here as ?reset_token=...
  const [resetToken, setResetToken] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('reset_token')
  );
  const [loginNotice, setLoginNotice] = useState('');

  const finishPasswordReset = (message: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('reset_token');
    window.history.replaceState(null, '', url.toString());
    setResetToken(null);
    setLoginNotice(message);
    setAuthView('login');
  };

  // Default tab should always be 'own' ("My Tasks") upon login or user change
  useEffect(() => {
    if (currentUser) {
      setActiveTab('own');
    }
  }, [currentUser?.id]);

  // Modal States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskModalMode, setTaskModalMode] = useState<'own' | 'team'>('own');
  const [commentTask, setCommentTask] = useState<Task | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);
  const [completedModalScope, setCompletedModalScope] = useState<'own' | 'team'>('own');

  // Filter active tasks (completed tasks are archived and shown via Completed modal/profile)
  const activeMyTasks = useMemo(
    () => myTasks.filter(t => t.status !== 'Completed'),
    [myTasks]
  );
  const completedMyTasks = useMemo(
    () => myTasks.filter(t => t.status === 'Completed'),
    [myTasks]
  );

  // Team active and completed tasks
  const activeTeamTasks = useMemo(() => {
    if (teamFilters.status === 'Completed') {
      return teamTasks.filter(t => t.status === 'Completed');
    }
    if (teamFilters.status && teamFilters.status !== 'All') {
      return teamTasks.filter(t => t.status === teamFilters.status);
    }
    return teamTasks.filter(t => t.status !== 'Completed');
  }, [teamTasks, teamFilters.status]);

  const completedTeamTasks = useMemo(
    () => teamTasks.filter(t => t.status === 'Completed'),
    [teamTasks]
  );

  // Urgent tasks (near deadline or overdue among active tasks)
  const urgentTasks = useMemo(
    () => activeMyTasks.filter(t => isNearDeadline(t.deadline, t.status) || isOverdue(t.deadline, t.status)),
    [activeMyTasks]
  );

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '15px', color: 'var(--ink-soft)' }}>Loading ACNABIN Portal…</div>
      </div>
    );
  }

  if (resetToken) {
    return <ResetPasswordForm token={resetToken} onDone={finishPasswordReset} />;
  }

  // If user is not logged in, show Auth screens
  if (!currentUser) {
    return (
      <>
        {authView === 'login' ? (
          <LoginForm
            onSwitchToSignup={() => setAuthView('signup')}
            onSwitchToForgot={() => setIsForgotModalOpen(true)}
            notice={loginNotice}
          />
        ) : (
          <SignupForm onSwitchToLogin={() => setAuthView('login')} />
        )}

        <ForgotPasswordModal
          isOpen={isForgotModalOpen}
          onClose={() => setIsForgotModalOpen(false)}
        />
        <Toast message={toast} />
      </>
    );
  }

  // Open Add Task Modal
  const handleOpenAddTask = (mode: 'own' | 'team' = 'own') => {
    setEditingTask(null);
    setTaskModalMode(mode);
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    if (!canEditTask(currentUser, task, activeTab === 'team')) {
      setCommentTask(task);
      return;
    }
    setEditingTask(task);
    setTaskModalMode(activeTab === 'team' ? 'team' : 'own');
    setIsTaskModalOpen(true);
  };

  const handleOpenComment = (task: Task) => {
    setCommentTask(task);
  };

  return (
    <div className="app-container">
      {/* Header & User Profile Bar */}
      <Header 
        onOpenAddTask={() => handleOpenAddTask('own')} 
        onOpenRequestTask={() => setIsRequestModalOpen(true)}
      />

      {/* Navigation Tabs */}
      <NavigationTabs activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Pane 1: My Tasks */}
      {activeTab === 'own' && (
        <div className="tab-pane">
          <StatPills
            stats={myStats}
            variant="maroon"
            onPillClick={pill => {
              if (pill === 'COMPLETED') {
                setCompletedModalScope('own');
                setIsCompletedModalOpen(true);
              }
            }}
          />

          {/* Primary Active Task Table */}
          <TaskTable
            title="MY TASKS"
            bannerColor="teal"
            tasks={activeMyTasks}
            isLoading={tasksLoading}
            emptyMessage="You have no active tasks at the moment."
            onEditTask={handleEditTask}
            onOpenComment={handleOpenComment}
          />

          {/* Near Deadline / Overdue Urgent Tasks Table */}
          {urgentTasks.length > 0 && (
            <TaskTable
              title="⚠️ NEAR DEADLINE & OVERDUE TASKS"
              bannerColor="maroon"
              tasks={urgentTasks}
              isLoading={tasksLoading}
              emptyMessage="No urgent tasks."
              onEditTask={handleEditTask}
              onOpenComment={handleOpenComment}
            />
          )}
        </div>
      )}

      {/* Pane 2: Team Tasks */}
      {activeTab === 'team' && (
        <div className="tab-pane">
          <StatPills
            stats={teamStats}
            variant="teal"
            onPillClick={pill => {
              if (pill === 'COMPLETED') {
                setCompletedModalScope('team');
                setIsCompletedModalOpen(true);
              }
            }}
          />
          <TaskFilterBar onOpenAssignModal={() => handleOpenAddTask('team')} />
          <TaskTable
            title="TEAM ENGAGEMENT TASKS"
            bannerColor="maroon"
            tasks={activeTeamTasks}
            showTeamColumns={true}
            isLoading={tasksLoading}
            emptyMessage={
              teamFilters.status === 'Completed'
                ? 'No completed team tasks match the current filters.'
                : 'No active team tasks match the current filters.'
            }
            onEditTask={handleEditTask}
            onOpenComment={handleOpenComment}
          />
        </div>
      )}

      {/* Pane 3: Task Requests */}
      {activeTab === 'requests' && (
        <div className="tab-pane">
          <TaskRequestsView />
        </div>
      )}

      {/* Pane 4: Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="tab-pane">
          <NotificationsView />
        </div>
      )}

      {/* Pane 5: My Profile (including Assigned Clients) */}
      {activeTab === 'profile' && (
        <div className="tab-pane">
          <ProfileView onNavigateToTasks={() => setActiveTab('own')} />
        </div>
      )}

      {/* Pane 6: Manpower Directory */}
      {activeTab === 'manpower' && (
        <ManpowerView />
      )}

      {/* Proposal Tracker (people the Admin chose) */}
      {activeTab === 'invoices' && <InvoiceTracker />}

      {activeTab === 'proposals' && <ProposalTracker />}

      {/* Pane 7: Admin Panel */}
      {activeTab === 'admin' && (
        <div className="tab-pane">
          <AdminPanel />
        </div>
      )}

      {/* Background attachment uploads (Proposal Tracker) */}
      <UploadPanel />

      {/* Modals */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        taskToEdit={editingTask}
        mode={taskModalMode}
      />

      <RequestTaskModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
      />

      <CommentModal
        isOpen={Boolean(commentTask)}
        onClose={() => setCommentTask(null)}
        task={commentTask}
      />

      <CompletedTasksModal
        isOpen={isCompletedModalOpen}
        onClose={() => setIsCompletedModalOpen(false)}
        tasks={completedModalScope === 'team' ? completedTeamTasks : completedMyTasks}
        title={completedModalScope === 'team' ? 'Completed Team Tasks Archive' : 'My Completed Tasks Archive'}
        showTeamColumns={completedModalScope === 'team'}
        onEditTask={handleEditTask}
        onOpenComment={handleOpenComment}
      />

      <Toast message={toast} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <TaskProvider>
        <NotificationProvider>
          <MainApp />
        </NotificationProvider>
      </TaskProvider>
    </AuthProvider>
  );
}
