import { vi } from 'vitest';

export interface MockTRPCRouter {
  useQuery?: ReturnType<typeof vi.fn>;
  useMutation?: ReturnType<typeof vi.fn>;
  useInfiniteQuery?: ReturnType<typeof vi.fn>;
  useSubscription?: ReturnType<typeof vi.fn>;
}

export interface MockTRPCUtils {
  [key: string]: {
    list?: { invalidate: ReturnType<typeof vi.fn> };
    get?: { invalidate: ReturnType<typeof vi.fn> };
    getById?: { invalidate: ReturnType<typeof vi.fn> };
    invalidate?: ReturnType<typeof vi.fn>;
  };
}

// Default query mock that can be customized
export const createQueryMock = (data?: any, options?: Partial<{
  isLoading: boolean;
  isError: boolean;
  error: any;
  refetch: ReturnType<typeof vi.fn>;
}>) => {
  return vi.fn(() => ({
    data,
    isLoading: options?.isLoading ?? false,
    isError: options?.isError ?? false,
    error: options?.error ?? null,
    refetch: options?.refetch ?? vi.fn(),
    isSuccess: !options?.isLoading && !options?.isError,
    isFetching: false,
    isRefetching: false,
    status: options?.isLoading ? 'loading' : options?.isError ? 'error' : 'success',
  }));
};

// Helper to create query result with minimal typing
export const createQueryResult = (data?: any, options?: Partial<{
  isLoading: boolean;
  isError: boolean;
  error: any;
}>) => ({
  data,
  isLoading: options?.isLoading ?? false,
  isError: options?.isError ?? false,
  error: options?.error ?? null,
  refetch: vi.fn(),
  isSuccess: !options?.isLoading && !options?.isError,
  isFetching: false,
  isRefetching: false,
  status: options?.isLoading ? 'loading' : options?.isError ? 'error' : 'success' as const,
});

// Default mutation mock that can be customized
export const createMutationMock = (options?: {
  onSuccess?: () => void;
  onError?: (error: any) => void;
  isPending?: boolean;
}) => {
  return vi.fn((mutationOptions?: any) => {
    // Store callbacks if provided
    const onSuccess = mutationOptions?.onSuccess || options?.onSuccess;
    const onError = mutationOptions?.onError || options?.onError;
    
    return {
      mutate: vi.fn((_variables?: any) => {
        // Simulate async behavior
        if (onSuccess) {
          setTimeout(() => onSuccess(), 0);
        }
      }),
      mutateAsync: vi.fn(async (variables?: any) => {
        // Simulate async behavior
        if (onSuccess) {
          return Promise.resolve(variables);
        }
        if (onError) {
          return Promise.reject(new Error('Mutation failed'));
        }
        return Promise.resolve(variables);
      }),
      isPending: options?.isPending ?? false,
      isIdle: !options?.isPending,
      isError: false,
      isSuccess: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    };
  });
};

// Create a complete mock for useUtils
export const createUseUtilsMock = (customUtils?: Partial<MockTRPCUtils>): MockTRPCUtils => {
  const defaultUtils: MockTRPCUtils = {
    items: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    inventory: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    warehouses: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    suppliers: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    orders: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    purchaseOrders: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    customers: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    categories: {
      list: { invalidate: vi.fn() },
      getById: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    stockMovements: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    receipts: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    shipments: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    returns: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    locations: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    organizations: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    unitsOfMeasure: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    itemCategories: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    users: {
      list: { invalidate: vi.fn() },
      getById: { invalidate: vi.fn() },
      invalidate: vi.fn(),
    },
    auth: {
      invalidate: vi.fn(),
    },
  };

  // Merge custom utils with defaults
  return { ...defaultUtils, ...customUtils } as MockTRPCUtils;
};

// Main factory function to create a complete tRPC mock
export const createTRPCMock = (customRouters?: Record<string, any>) => {
  const mockUtils = createUseUtilsMock();
  
  const defaultMock = {
    useUtils: vi.fn(() => mockUtils),
    // Add any other global tRPC functions here
  };

  // Merge with custom routers
  return {
    trpc: {
      ...defaultMock,
      ...customRouters,
    },
    mockUtils, // Export utils for test assertions
  };
};

// Helper to create a complete router mock
export const createRouterMock = (methods: Record<string, 'query' | 'mutation'>, customImplementations?: Record<string, any>) => {
  const router: Record<string, any> = {};
  
  Object.entries(methods).forEach(([method, type]) => {
    if (type === 'query') {
      router[method] = {
        useQuery: customImplementations?.[method]?.useQuery || createQueryMock(),
      };
    } else if (type === 'mutation') {
      router[method] = {
        useMutation: customImplementations?.[method]?.useMutation || createMutationMock(),
      };
    }
  });
  
  return router;
};

// Pre-built router mocks for common routers
export const mockRouters = {
  items: () => createRouterMock({
    list: 'query',
    get: 'query',
    create: 'mutation',
    update: 'mutation',
    delete: 'mutation',
    duplicate: 'mutation',
    archive: 'mutation',
  }),
  
  inventory: () => createRouterMock({
    list: 'query',
    get: 'query',
    adjust: 'mutation',
    transfer: 'mutation',
    count: 'mutation',
  }),
  
  warehouses: () => ({
    ...createRouterMock({
      list: 'query',
      get: 'query',
      create: 'mutation',
      update: 'mutation',
      delete: 'mutation',
    }),
    locations: {
      list: { useQuery: createQueryMock() },
      create: { useMutation: createMutationMock() },
      update: { useMutation: createMutationMock() },
      delete: { useMutation: createMutationMock() },
    },
  }),
  
  suppliers: () => createRouterMock({
    list: 'query',
    get: 'query',
    create: 'mutation',
    update: 'mutation',
    delete: 'mutation',
  }),
  
  orders: () => createRouterMock({
    list: 'query',
    get: 'query',
    create: 'mutation',
    update: 'mutation',
    cancel: 'mutation',
    fulfill: 'mutation',
  }),
  
  purchaseOrders: () => createRouterMock({
    list: 'query',
    get: 'query',
    create: 'mutation',
    update: 'mutation',
    submit: 'mutation',
    approve: 'mutation',
    reject: 'mutation',
    cancel: 'mutation',
    receive: 'mutation',
  }),
  
  customers: () => createRouterMock({
    list: 'query',
    get: 'query',
    create: 'mutation',
    update: 'mutation',
    delete: 'mutation',
  }),
  
  categories: () => createRouterMock({
    list: 'query',
    getById: 'query',
    create: 'mutation',
    update: 'mutation',
    delete: 'mutation',
  }),
  
  itemCategories: () => createRouterMock({
    list: 'query',
    get: 'query',
    create: 'mutation',
    update: 'mutation',
    delete: 'mutation',
  }),
  
  unitsOfMeasure: () => createRouterMock({
    list: 'query',
    get: 'query',
    create: 'mutation',
    update: 'mutation',
    delete: 'mutation',
  }),
  
  users: () => createRouterMock({
    list: 'query',
    getById: 'query',
    create: 'mutation',
    update: 'mutation',
    delete: 'mutation',
  }),
  
  stockMovements: () => createRouterMock({
    list: 'query',
    get: 'query',
    create: 'mutation',
    reverse: 'mutation',
  }),
  
  receipts: () => createRouterMock({
    list: 'query',
    get: 'query',
    create: 'mutation',
    update: 'mutation',
    cancel: 'mutation',
  }),
  
  shipments: () => createRouterMock({
    list: 'query',
    get: 'query',
    create: 'mutation',
    update: 'mutation',
    ship: 'mutation',
    deliver: 'mutation',
    cancel: 'mutation',
  }),
  
  returns: () => createRouterMock({
    list: 'query',
    get: 'query',
    create: 'mutation',
    update: 'mutation',
    approve: 'mutation',
    reject: 'mutation',
    receive: 'mutation',
  }),
  
  auth: () => createRouterMock({
    login: 'mutation',
    logout: 'mutation',
    register: 'mutation',
    me: 'query',
  }),
  
  organizations: () => createRouterMock({
    list: 'query',
    get: 'query',
    create: 'mutation',
    update: 'mutation',
    switchOrganization: 'mutation',
  }),
};