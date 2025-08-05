'use client';

import { trpc } from '@/lib/trpc';
import { Card } from '@ventry/ui';

export default function DebugPage() {
  const { data: authData, isLoading: authLoading, error: authError } = trpc.auth.debug.useQuery();
  const {
    data: customerData,
    isLoading: customerLoading,
    error: customerError,
  } = trpc.customers.debugCount.useQuery();
  const {
    data: listData,
    isLoading: listLoading,
    error: listError,
  } = trpc.customers.list.useQuery({
    limit: 100,
  });
  const {
    data: receiptsData,
    isLoading: receiptsLoading,
    error: receiptsError,
  } = trpc.receipts.list.useQuery({
    limit: 100,
  });

  if (authLoading || customerLoading || listLoading || receiptsLoading)
    return <div>Loading...</div>;
  if (authError) return <div>Auth Error: {authError.message}</div>;
  if (customerError) return <div>Customer Error: {customerError.message}</div>;
  if (listError) return <div>List Error: {listError.message}</div>;
  if (receiptsError) return <div>Receipts Error: {receiptsError.message}</div>;

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Debug Information</h1>

      <div>
        <h2 className="text-xl font-semibold mb-2">Auth Context</h2>
        <Card className="p-4">
          <pre>{JSON.stringify(authData, null, 2)}</pre>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Customer Count</h2>
        <Card className="p-4">
          <pre>{JSON.stringify(customerData, null, 2)}</pre>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Customer List Response</h2>
        <Card className="p-4">
          <pre>{JSON.stringify(listData, null, 2)}</pre>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Receipts List Response</h2>
        <Card className="p-4">
          <p>Total receipts: {receiptsData?.receipts?.length || 0}</p>
          <pre>{JSON.stringify(receiptsData, null, 2)}</pre>
        </Card>
      </div>
    </div>
  );
}
