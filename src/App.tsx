import React, { useEffect, useState } from 'react';
import { AdminPanel } from './components/admin/AdminPanel';
import { ForgotPasswordModal } from './components/auth/ForgotPasswordModal';
import { LoginForm } from './components/auth/LoginForm';
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

const MainApp: React.FC = () => {
  const { currentUser, isLoading: authLoading } = useAuth();
  const { myTasks, teamTasks, myStats, teamStats, isLoading: tasksLoading, toast } = useTasks();

  const [activeTab, setActiveTab] = useState<TabKey>('own');
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

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

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '15px', color: 'var(--ink-soft)' }}>Loading ACNABIN Portal…</div>
      </div>
    );
  }

  // If user is not logged in, show Auth screens
  if (!currentUser) {
    return (
      <>
        {authView === 'login' ? (
          <LoginForm
            onSwitchToSignup={() => setAuthView('signup')}
            onSwitchToForgot={() => setIsForgotModalOpen(true)}
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

  // Urgent tasks (near deadline or overdue)
  const urgentTasks = myTasks.filter(
    t => isNearDeadline(t.deadline, t.status) || isOverdue(t.deadline, t.status)
  );

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
          <StatPills stats={myStats} variant="maroon" />

          {/* Primary Task Table */}
          <TaskTable
            title="MY TASKS"
            bannerColor="teal"
            tasks={myTasks}
            isLoading={tasksLoading}
            emptyMessage="You have no assigned tasks at the moment."
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
          <StatPills stats={teamStats} variant="teal" />
          <TaskFilterBar onOpenAssignModal={() => handleOpenAddTask('team')} />
          <TaskTable
            title="TEAM ENGAGEMENT TASKS"
            bannerColor="maroon"
            tasks={teamTasks}
            showTeamColumns={true}
            isLoading={tasksLoading}
            emptyMessage="No team tasks match the current filters."
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
          <ProfileView />
        </div>
      )}

      {/* Pane 6: Admin Panel */}
      {activeTab === 'admin' && (
        <div className="tab-pane">
          <AdminPanel />
        </div>
      )}

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
