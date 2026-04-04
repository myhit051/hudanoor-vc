import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStockItems, addStockItem, deleteStockItem, updateStockItem, NewStockItem, UpdateStockItem } from '@/lib/stock-api';
import { toast } from '@/hooks/use-toast';

export function useStock(params?: { date?: string; sku?: string }) {
  const queryClient = useQueryClient();

  const { data: stockItems = [], isLoading, refetch } = useQuery({
    queryKey: ['stock', params],
    queryFn: () => getStockItems(params),
    staleTime: 30 * 1000,
    retry: 1,
    refetchOnWindowFocus: false
  });

  const addMutation = useMutation({
    mutationFn: addStockItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStockItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: 'ลบรายการสำเร็จ' });
    },
    onError: () => {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถลบรายการได้', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStockItem }) => updateStockItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: 'แก้ไขรายการสำเร็จ' });
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  });

  return {
    stockItems,
    isLoading,
    refetch,
    addStock: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    deleteStock: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    updateStock: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending
  };
}
