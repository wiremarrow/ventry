import { UserProfile, Role } from '../types/auth';

export const hasRole = (user: UserProfile, role: Role): boolean => {
  return user.role === role;
};

export const hasAnyRole = (user: UserProfile, roles: Role[]): boolean => {
  return roles.includes(user.role);
};

export const isAdmin = (user: UserProfile): boolean => {
  return hasRole(user, 'ADMIN');
};

export const isManager = (user: UserProfile): boolean => {
  return hasRole(user, 'MANAGER');
};

export const isUser = (user: UserProfile): boolean => {
  return hasRole(user, 'USER');
};

export const isEmployee = (user: UserProfile): boolean => {
  return hasRole(user, 'EMPLOYEE');
};

export const canManageUsers = (user: UserProfile): boolean => {
  return hasAnyRole(user, ['ADMIN', 'MANAGER']);
};

export const canManageProducts = (user: UserProfile): boolean => {
  return hasAnyRole(user, ['ADMIN', 'MANAGER']);
};

export const canViewProducts = (user: UserProfile): boolean => {
  return hasAnyRole(user, ['ADMIN', 'MANAGER', 'EMPLOYEE']);
};

export const canViewInventory = (user: UserProfile): boolean => {
  return hasAnyRole(user, ['ADMIN', 'MANAGER']);
};

export const canViewMovements = (user: UserProfile): boolean => {
  return hasAnyRole(user, ['ADMIN', 'MANAGER']);
};

export const canManageInventory = (user: UserProfile): boolean => {
  return hasAnyRole(user, ['ADMIN', 'MANAGER']);
};

export const canViewReports = (user: UserProfile): boolean => {
  return hasAnyRole(user, ['ADMIN', 'MANAGER']);
};

export const canDeleteData = (user: UserProfile): boolean => {
  return hasRole(user, 'ADMIN');
};

export const canManageLocations = (user: UserProfile): boolean => {
  return hasAnyRole(user, ['ADMIN', 'MANAGER']);
};

export const canManageCategories = (user: UserProfile): boolean => {
  return hasAnyRole(user, ['ADMIN', 'MANAGER']);
};

export const getPermissions = (user: UserProfile) => {
  return {
    canManageUsers: canManageUsers(user),
    canManageProducts: canManageProducts(user),
    canViewProducts: canViewProducts(user),
    canViewInventory: canViewInventory(user),
    canViewMovements: canViewMovements(user),
    canManageInventory: canManageInventory(user),
    canViewReports: canViewReports(user),
    canDeleteData: canDeleteData(user),
    canManageLocations: canManageLocations(user),
    canManageCategories: canManageCategories(user),
    isAdmin: isAdmin(user),
    isManager: isManager(user),
    isUser: isUser(user),
    isEmployee: isEmployee(user),
  };
};

export const getRoleDisplayName = (role: string): string => {
  const roleNames = {
    ADMIN: 'Administrator',
    MANAGER: 'Manager',
    USER: 'User',
    EMPLOYEE: 'Employee',
    WAREHOUSE: 'Warehouse Staff',
    SALES: 'Sales Representative',
  };

  return roleNames[role as keyof typeof roleNames] || role;
};

export const getRoleColor = (role: string): string => {
  const roleColors = {
    ADMIN: 'red',
    MANAGER: 'blue',
    USER: 'green',
    EMPLOYEE: 'purple',
    WAREHOUSE: 'orange',
    SALES: 'teal',
  };

  return roleColors[role as keyof typeof roleColors] || 'gray';
};
