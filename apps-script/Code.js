/**
 * Code.js – ACNABIN Task Tracker Backend for Google Sheets
 * Supports:
 * 1. REST API endpoint via doPost(e) for modern React frontend
 * 2. Role & Designation permissions
 * 3. Client Master and Manager Access Matrices
 */

var SHEET_NAMES = {
  USERS: 'Users',
  CLIENTS: 'Clients',
  MANAGER_STUDENT_ACCESS: 'ManagerStudentAccess',
  MANAGER_CLIENT_ACCESS: 'ManagerClientAccess',
  TASKS: 'Tasks',
  RESET_TOKENS: 'PasswordResetTokens',
  SESSIONS: 'Sessions',
  ACTIVITY_LOG: 'ActivityLog',
  APP_SETTINGS: 'AppSettings'
};

var SHEET_HEADERS = {
  Users: ['UserID', 'Name', 'EmpStdID', 'Email', 'PasswordHash', 'Role', 'Designation', 'SignupClientID', 'Status', 'CreatedDate', 'UpdatedDate', 'LastLogin'],
  Clients: ['ClientID', 'ClientName', 'JobNumber', 'Status', 'CreatedDate', 'LastUpdated'],
  ManagerStudentAccess: ['AccessID', 'ManagerUserID', 'StudentUserID', 'Status', 'CreatedBy', 'CreatedDate', 'LastUpdated'],
  ManagerClientAccess: ['AccessID', 'ManagerUserID', 'ClientID', 'Status', 'CreatedBy', 'CreatedDate', 'LastUpdated'],
  Tasks: ['TaskID', 'ClientID', 'AssignedTo', 'CreatedBy', 'Particular', 'Priority', 'Deadline', 'Status', 'Remarks', 'ManagerComment', 'CreatedDate', 'LastUpdated', 'AssignedDate'],
  PasswordResetTokens: ['TokenID', 'UserID', 'TokenHash', 'Expiry', 'Used', 'CreatedDate'],
  Sessions: ['SessionID', 'UserID', 'TokenHash', 'CreatedDate', 'Expiry'],
  ActivityLog: ['LogID', 'UserID', 'Action', 'TargetType', 'TargetID', 'Timestamp', 'Details'],
  AppSettings: ['SettingKey', 'SettingValue']
};

var DESIGNATIONS = ['Student', 'In Charge', 'Supervisor', 'Senior Assistant Manager', 'Deputy Manager', 'Manager', 'Assistant Director', 'Deputy Director', 'Director', 'Partner'];

// ============================================================================
// SHEET HELPERS
// ============================================================================
function getOrCreateSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var headers = SHEET_HEADERS[name];
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function readAllRows_(sheetName) {
  var sheet = getOrCreateSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return data.map(function (row, idx) {
    var obj = { _rowNumber: idx + 2 };
    headers.forEach(function (h, colIdx) {
      obj[h] = row[colIdx];
    });
    return obj;
  });
}

function appendRow_(sheetName, obj) {
  var sheet = getOrCreateSheet_(sheetName);
  var headers = SHEET_HEADERS[sheetName];
  var row = headers.map(function (h) {
    return obj[h] !== undefined ? obj[h] : '';
  });
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function updateRowFields_(sheetName, rowNumber, fields) {
  var sheet = getOrCreateSheet_(sheetName);
  var headers = SHEET_HEADERS[sheetName];
  headers.forEach(function (h, colIdx) {
    if (fields[h] !== undefined) {
      sheet.getRange(rowNumber, colIdx + 1).setValue(fields[h]);
    }
  });
}

function deleteRow_(sheetName, rowNumber) {
  var sheet = getOrCreateSheet_(sheetName);
  sheet.deleteRow(rowNumber);
}

// ============================================================================
// API DISPATCHER (doPost for React Frontend)
// ============================================================================
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var request = JSON.parse(raw);
    var action = request.action;
    var payload = request.payload || {};

    var result = handleApiAction_(action, payload);
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'online', service: 'ACNABIN Task Tracker API' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleApiAction_(action, payload) {
  switch (action) {
    case 'login':
      return loginUser_(payload.empId, payload.password);
    case 'register':
      return registerUser_(payload);
    case 'getMyTasks':
      return getMyTasks_(payload.userId);
    case 'getTeamTasks':
      return getTeamTasks_(payload.userId, payload.filters);
    case 'createTask':
      return createTask_(payload);
    case 'updateTask':
      return updateTask_(payload.taskId, payload.updates);
    case 'deleteTask':
      return deleteTask_(payload.taskId);
    case 'addManagerComment':
      return addManagerComment_(payload.taskId, payload.comment);
    case 'getAllClients':
      return getAllClients_();
    case 'addClient':
      return addClient_(payload.name, payload.jobNumber);
    case 'updateClient':
      return updateClient_(payload.clientId, payload);
    case 'getAllUsers':
      return getAllUsers_();
    case 'updateUser':
      return updateUser_(payload.userId, payload.updates);
    case 'getManagerClients':
      return getManagerClients_(payload.managerUserId);
    case 'saveManagerClients':
      return saveManagerClients_(payload.managerUserId, payload.clientIds);
    case 'getManagerStudents':
      return getManagerStudents_(payload.managerUserId);
    case 'saveManagerStudents':
      return saveManagerStudents_(payload.managerUserId, payload.studentIds);
    case 'getManagerClientIds':
      return getManagerClientIds_(payload.managerUserId);
    default:
      throw new Error('Unsupported action: ' + action);
  }
}

// ============================================================================
// BUSINESS LOGIC IMPLEMENTATION
// ============================================================================
function loginUser_(empId, password) {
  var users = readAllRows_(SHEET_NAMES.USERS);
  var input = String(empId).trim().toUpperCase();
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var emp = String(u.EmpStdID).trim().toUpperCase();
    var email = String(u.Email).trim().toLowerCase();
    if (emp === input || email === input.toLowerCase()) {
      target = u;
      break;
    }
    // Check 2-letter partner initials
    if (input.length === 2 && (u.Designation === 'Partner' || u.Role === 'ADMIN')) {
      var initials = u.Name.split(' ').map(function (w) { return w ? w[0] : ''; }).join('').toUpperCase();
      if (initials.indexOf(input) !== -1 || emp.indexOf(input) !== -1) {
        target = u;
        break;
      }
    }
  }
  if (!target) throw new Error('User not found. Check your Student ID, Employee ID, Partner initials, or email.');
  if (target.Status !== 'ACTIVE') throw new Error('User account is inactive.');

  return {
    user: {
      id: target.UserID,
      name: target.Name,
      empId: target.EmpStdID,
      email: target.Email,
      role: target.Role,
      designation: target.Designation,
      signupClientId: target.SignupClientID,
      status: target.Status
    },
    token: 'session_' + Utilities.getUuid()
  };
}

function registerUser_(payload) {
  var users = readAllRows_(SHEET_NAMES.USERS);
  var empId = String(payload.empId).trim().toUpperCase();
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].EmpStdID).toUpperCase() === empId) {
      throw new Error('A user with this Employee/Student ID already exists.');
    }
  }

  var newId = 'u-' + Utilities.getUuid().slice(0, 8);
  var now = new Date().toISOString();
  var designation = payload.designation || 'Student';
  appendRow_(SHEET_NAMES.USERS, {
    UserID: newId,
    Name: payload.name,
    EmpStdID: empId,
    Email: payload.email,
    PasswordHash: 'hash',
    Role: 'USER',
    Designation: designation,
    SignupClientID: payload.clientId || '',
    Status: 'ACTIVE',
    CreatedDate: now,
    UpdatedDate: now
  });

  return {
    user: {
      id: newId,
      name: payload.name,
      empId: empId,
      email: payload.email,
      role: 'USER',
      designation: designation,
      signupClientId: payload.clientId,
      status: 'ACTIVE'
    },
    token: 'session_' + Utilities.getUuid()
  };
}

function getMyTasks_(userId) {
  var rows = readAllRows_(SHEET_NAMES.TASKS);
  var clients = getAllClients_();
  var users = getAllUsers_();

  var clientMap = {};
  clients.forEach(function (c) { clientMap[c.id] = c.name; });
  var userMap = {};
  users.forEach(function (u) { userMap[u.id] = u.name; });

  return rows
    .filter(function (r) { return r.AssignedTo === userId; })
    .map(function (r) {
      return {
        id: r.TaskID,
        clientId: r.ClientID,
        clientName: clientMap[r.ClientID] || 'General',
        assignedToId: r.AssignedTo,
        assignedToName: userMap[r.AssignedTo] || 'Unknown',
        createdById: r.CreatedBy,
        createdByName: userMap[r.CreatedBy] || 'Admin',
        particular: r.Particular,
        priority: r.Priority,
        assignedDate: r.AssignedDate,
        deadline: r.Deadline,
        status: r.Status,
        remarks: r.Remarks,
        managerComment: r.ManagerComment,
        createdDate: r.CreatedDate
      };
    });
}

function getTeamTasks_(userId, filters) {
  var rows = readAllRows_(SHEET_NAMES.TASKS);
  var clients = getAllClients_();
  var users = getAllUsers_();

  var clientMap = {};
  clients.forEach(function (c) { clientMap[c.id] = c.name; });
  var userMap = {};
  users.forEach(function (u) { userMap[u.id] = u.name; });
  var userDesigMap = {};
  users.forEach(function (u) { userDesigMap[u.id] = u.designation; });

  var AD_AND_ABOVE = ['Assistant Director', 'Deputy Director', 'Director', 'Partner'];
  var SUPERVISOR_TO_MANAGER = ['In Charge', 'Supervisor', 'Senior Assistant Manager', 'Deputy Manager', 'Manager'];

  // Find the calling user
  var callingUser = users.find(function (u) { return u.id === userId; });
  var isAdmin = callingUser && callingUser.role === 'ADMIN';
  var designation = callingUser ? callingUser.designation : '';

  // Determine allowed client IDs for Supervisor-to-Manager
  var allowedClientIds = null;
  if (!isAdmin && SUPERVISOR_TO_MANAGER.indexOf(designation) !== -1) {
    var accessRows = readAllRows_(SHEET_NAMES.MANAGER_CLIENT_ACCESS);
    allowedClientIds = accessRows
      .filter(function (r) { return r.ManagerUserID === userId && r.Status === 'ACTIVE'; })
      .map(function (r) { return r.ClientID; });
    // Also include signupClientId
    if (callingUser.signupClientId) {
      callingUser.signupClientId.split(',').forEach(function (cid) {
        cid = cid.trim();
        if (cid && allowedClientIds.indexOf(cid) === -1) allowedClientIds.push(cid);
      });
    }
  }

  var lowerRankDesig = ['Student', 'In Charge', 'Supervisor', 'Senior Assistant Manager', 'Deputy Manager', 'Manager'];

  var filtered = rows.filter(function (r) {
    if (!isAdmin && AD_AND_ABOVE.indexOf(designation) === -1) {
      // Supervisor-to-Manager: restrict to allowed clients only
      if (allowedClientIds !== null && allowedClientIds.indexOf(r.ClientID) === -1) return false;
      // Only show tasks assigned to lower/same rank
      var assigneeDesig = userDesigMap[r.AssignedTo] || '';
      if (lowerRankDesig.indexOf(assigneeDesig) === -1 && r.AssignedTo !== userId) return false;
    }
    // AD+ and ADMIN: no restriction
    return true;
  });

  // Apply UI filters
  filters = filters || {};
  if (filters.clientId) {
    filtered = filtered.filter(function (r) { return r.ClientID === filters.clientId; });
  }
  if (filters.memberId) {
    filtered = filtered.filter(function (r) { return r.AssignedTo === filters.memberId; });
  }
  if (filters.status && filters.status !== 'All') {
    filtered = filtered.filter(function (r) { return r.Status === filters.status; });
  }

  return filtered.map(function (r) {
    return {
      id: r.TaskID,
      clientId: r.ClientID,
      clientName: clientMap[r.ClientID] || 'General',
      assignedToId: r.AssignedTo,
      assignedToName: userMap[r.AssignedTo] || 'Unknown',
      createdById: r.CreatedBy,
      createdByName: userMap[r.CreatedBy] || 'Admin',
      particular: r.Particular,
      priority: r.Priority,
      assignedDate: r.AssignedDate,
      deadline: r.Deadline,
      status: r.Status,
      remarks: r.Remarks,
      managerComment: r.ManagerComment,
      createdDate: r.CreatedDate
    };
  });
}

function createTask_(payload) {
  var newId = 'TSK-' + Math.floor(100 + Math.random() * 900);
  var now = new Date().toISOString();
  appendRow_(SHEET_NAMES.TASKS, {
    TaskID: newId,
    ClientID: payload.clientId,
    AssignedTo: payload.assignedToId,
    CreatedBy: payload.createdById || 'Admin',
    Particular: payload.particular,
    Priority: payload.priority || 'Medium',
    Deadline: payload.deadline || '',
    Status: payload.status || 'Pending',
    Remarks: payload.remarks || '',
    ManagerComment: payload.managerComment || '',
    CreatedDate: now,
    LastUpdated: now,
    AssignedDate: payload.assignedDate || now.slice(0, 10)
  });
  return { id: newId, ...payload };
}

function updateTask_(taskId, updates) {
  var rows = readAllRows_(SHEET_NAMES.TASKS);
  var target = rows.find(function (r) { return r.TaskID === taskId; });
  if (!target) throw new Error('Task not found');

  var fields = { LastUpdated: new Date().toISOString() };
  if (updates.status !== undefined) fields.Status = updates.status;
  if (updates.remarks !== undefined) fields.Remarks = updates.remarks;
  if (updates.managerComment !== undefined) fields.ManagerComment = updates.managerComment;
  if (updates.priority !== undefined) fields.Priority = updates.priority;
  if (updates.deadline !== undefined) fields.Deadline = updates.deadline;
  if (updates.particular !== undefined) fields.Particular = updates.particular;
  if (updates.clientId !== undefined) fields.ClientID = updates.clientId;
  if (updates.assignedToId !== undefined) fields.AssignedTo = updates.assignedToId;

  updateRowFields_(SHEET_NAMES.TASKS, target._rowNumber, fields);
  return { success: true };
}

function deleteTask_(taskId) {
  var rows = readAllRows_(SHEET_NAMES.TASKS);
  var target = rows.find(function (r) { return r.TaskID === taskId; });
  if (!target) throw new Error('Task not found');
  deleteRow_(SHEET_NAMES.TASKS, target._rowNumber);
  return { success: true };
}

function addManagerComment_(taskId, comment) {
  return updateTask_(taskId, { managerComment: comment });
}

function getAllClients_() {
  var rows = readAllRows_(SHEET_NAMES.CLIENTS);
  return rows.map(function (r) {
    return {
      id: r.ClientID,
      name: r.ClientName,
      jobNumber: r.JobNumber,
      status: r.Status || 'ACTIVE'
    };
  });
}

function addClient_(name, jobNumber) {
  var newId = 'c-' + Utilities.getUuid().slice(0, 6);
  var now = new Date().toISOString();
  appendRow_(SHEET_NAMES.CLIENTS, {
    ClientID: newId,
    ClientName: name,
    JobNumber: jobNumber || '',
    Status: 'ACTIVE',
    CreatedDate: now,
    LastUpdated: now
  });
  return { id: newId, name: name, jobNumber: jobNumber, status: 'ACTIVE' };
}

function updateClient_(clientId, updates) {
  var rows = readAllRows_(SHEET_NAMES.CLIENTS);
  var target = rows.find(function (r) { return r.ClientID === clientId; });
  if (!target) throw new Error('Client not found');

  var fields = { LastUpdated: new Date().toISOString() };
  if (updates.name !== undefined) fields.ClientName = updates.name;
  if (updates.jobNumber !== undefined) fields.JobNumber = updates.jobNumber;
  if (updates.status !== undefined) fields.Status = updates.status;

  updateRowFields_(SHEET_NAMES.CLIENTS, target._rowNumber, fields);
  return { success: true };
}

function getAllUsers_() {
  var rows = readAllRows_(SHEET_NAMES.USERS);
  return rows.map(function (r) {
    return {
      id: r.UserID,
      name: r.Name,
      empId: r.EmpStdID,
      email: r.Email,
      role: r.Role,
      designation: r.Designation,
      signupClientId: r.SignupClientID,
      status: r.Status
    };
  });
}

function updateUser_(userId, updates) {
  var rows = readAllRows_(SHEET_NAMES.USERS);
  var target = rows.find(function (r) { return r.UserID === userId; });
  if (!target) throw new Error('User not found');

  var fields = { UpdatedDate: new Date().toISOString() };
  if (updates.designation !== undefined) fields.Designation = updates.designation;
  if (updates.role !== undefined) fields.Role = updates.role;
  if (updates.status !== undefined) fields.Status = updates.status;
  if (updates.signupClientId !== undefined) fields.SignupClientID = updates.signupClientId;

  updateRowFields_(SHEET_NAMES.USERS, target._rowNumber, fields);
  return { success: true };
}

function getManagerClients_(managerUserId) {
  var allClients = getAllClients_();
  var accessRows = readAllRows_(SHEET_NAMES.MANAGER_CLIENT_ACCESS);
  var assigned = accessRows
    .filter(function (r) { return r.ManagerUserID === managerUserId && r.Status === 'ACTIVE'; })
    .map(function (r) { return r.ClientID; });

  return allClients.map(function (c) {
    return {
      clientId: c.id,
      clientName: c.name,
      hasAccess: assigned.indexOf(c.id) !== -1
    };
  });
}

function saveManagerClients_(managerUserId, clientIds) {
  var sheet = getOrCreateSheet_(SHEET_NAMES.MANAGER_CLIENT_ACCESS);
  var rows = readAllRows_(SHEET_NAMES.MANAGER_CLIENT_ACCESS);
  // Remove existing
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].ManagerUserID === managerUserId) {
      sheet.deleteRow(rows[i]._rowNumber);
    }
  }
  var now = new Date().toISOString();
  clientIds.forEach(function (cid) {
    appendRow_(SHEET_NAMES.MANAGER_CLIENT_ACCESS, {
      AccessID: 'acc-' + Utilities.getUuid().slice(0, 6),
      ManagerUserID: managerUserId,
      ClientID: cid,
      Status: 'ACTIVE',
      CreatedBy: 'Admin',
      CreatedDate: now,
      LastUpdated: now
    });
  });
  return { success: true };
}

function getManagerStudents_(managerUserId) {
  var allUsers = getAllUsers_();
  var students = allUsers.filter(function (u) { return u.designation === 'Student'; });
  var accessRows = readAllRows_(SHEET_NAMES.MANAGER_STUDENT_ACCESS);
  var assigned = accessRows
    .filter(function (r) { return r.ManagerUserID === managerUserId && r.Status === 'ACTIVE'; })
    .map(function (r) { return r.StudentUserID; });

  return students.map(function (s) {
    return {
      studentId: s.id,
      studentName: s.name,
      empId: s.empId,
      isAssigned: assigned.indexOf(s.id) !== -1
    };
  });
}

function saveManagerStudents_(managerUserId, studentIds) {
  var sheet = getOrCreateSheet_(SHEET_NAMES.MANAGER_STUDENT_ACCESS);
  var rows = readAllRows_(SHEET_NAMES.MANAGER_STUDENT_ACCESS);
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].ManagerUserID === managerUserId) {
      sheet.deleteRow(rows[i]._rowNumber);
    }
  }
  var now = new Date().toISOString();
  studentIds.forEach(function (sid) {
    appendRow_(SHEET_NAMES.MANAGER_STUDENT_ACCESS, {
      AccessID: 'msa-' + Utilities.getUuid().slice(0, 6),
      ManagerUserID: managerUserId,
      StudentUserID: sid,
      Status: 'ACTIVE',
      CreatedBy: 'Admin',
      CreatedDate: now,
      LastUpdated: now
    });
  });
  return { success: true };
}

function getManagerClientIds_(managerUserId) {
  var accessRows = readAllRows_(SHEET_NAMES.MANAGER_CLIENT_ACCESS);
  var ids = accessRows
    .filter(function (r) { return r.ManagerUserID === managerUserId && r.Status === 'ACTIVE'; })
    .map(function (r) { return r.ClientID; });
  // Also include signupClientId
  var users = getAllUsers_();
  var mgr = users.find(function (u) { return u.id === managerUserId; });
  if (mgr && mgr.signupClientId) {
    mgr.signupClientId.split(',').forEach(function (cid) {
      cid = cid.trim();
      if (cid && ids.indexOf(cid) === -1) ids.push(cid);
    });
  }
  return ids;
}
