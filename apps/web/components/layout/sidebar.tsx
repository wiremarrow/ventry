'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart3, 
  Box, 
  Building, 
  Building2,
  ChevronLeft, 
  ChevronRight, 
  Home, 
  Package, 
  ShoppingCart, 
  Tags, 
  TruckIcon,
  Users,
  UserCheck,
  Warehouse,
  FileCheck
} from 'lucide-react';
import { Button } from '@ventry/ui';
import { useAuthStore } from '@/lib/auth-store';
import { canManageUsers, canManageProducts, canViewReports, canManageLocations, canViewProducts, canViewInventory, canViewMovements } from '@ventry/shared';
import { cn } from '@ventry/ui';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navigationItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      show: true,
    },
    {
      label: 'Inventory',
      href: '/inventory',
      icon: Box,
      show: user ? canViewInventory(user) : false,
    },
    {
      label: 'Products',
      href: '/products',
      icon: Package,
      show: user ? canViewProducts(user) : false,
    },
    {
      label: 'Warehouses',
      href: '/warehouses',
      icon: Warehouse,
      show: user ? canManageLocations(user) : false,
    },
    {
      label: 'Suppliers',
      href: '/suppliers',
      icon: Building2,
      show: true, // TODO: Add proper permission check
    },
    {
      label: 'Customers',
      href: '/customers',
      icon: UserCheck,
      show: true, // TODO: Add proper permission check
    },
    {
      label: 'Orders',
      href: '/orders',
      icon: ShoppingCart,
      show: true, // TODO: Add proper permission check
    },
    {
      label: 'Purchase Orders',
      href: '/purchase-orders',
      icon: TruckIcon,
      show: true, // TODO: Add proper permission check
    },
    {
      label: 'Receipts',
      href: '/receipts',
      icon: FileCheck,
      show: true, // TODO: Add proper permission check
    },
    {
      label: 'Shipments',
      href: '/shipments',
      icon: TruckIcon,
      show: true, // TODO: Add proper permission check
    },
    {
      label: 'Categories',
      href: '/categories',
      icon: Tags,
      show: user ? canManageProducts(user) : false,
    },
    {
      label: 'Locations',
      href: '/locations',
      icon: Building,
      show: user ? canManageProducts(user) : false,
    },
    {
      label: 'Movements',
      href: '/movements',
      icon: ShoppingCart,
      show: user ? canViewMovements(user) : false,
    },
    {
      label: 'Reports',
      href: '/reports',
      icon: BarChart3,
      show: user ? canViewReports(user) : false,
    },
    {
      label: 'Users',
      href: '/users',
      icon: Users,
      show: user ? canManageUsers(user) : false,
    },
  ].filter(item => item.show);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 z-50 transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Collapse button - Desktop only */}
          <div className="hidden md:flex justify-end p-2 border-b border-gray-200">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (window.innerWidth < 768) {
                      onClose();
                    }
                  }}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
                    isCollapsed && 'justify-center'
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}