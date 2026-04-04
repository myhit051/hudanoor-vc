import { TaskReminder } from '@/types/task';

// API base URL - automatically detects environment
const API_BASE = typeof window !== 'undefined' 
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api')
  : '/api';

// Helper function to convert sheet data to TaskReminder objects
const parseTaskData = (rows: any[][]): TaskReminder[] => {
  if (!rows || rows.length <= 1) return [];
  
  // Skip header row
  return rows.slice(1).map((row, index) => ({
    id: row[0] || `task_${index + 1}`,
    title: row[1] || '',
    type: (row[2] || 'expense') as 'income' | 'expense',
    amount: parseFloat(row[3]) || 0,
    note: row[4] || '',
    dueDate: new Date(row[5] || new Date()),
    completed: row[6] === 'เสร็จแล้ว',
    createdAt: new Date(row[7] || new Date()),
  }));
};

// Read tasks data from Google Sheets via Vercel API
export const getTasksData = async (): Promise<TaskReminder[]> => {
  try {
    const response = await fetch(`${API_BASE}/tasks`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return parseTaskData(data.data || []);
  } catch (error) {
    console.error('Error fetching tasks data:', error);
    throw error;
  }
};

// Add new task record via Vercel API
export const addTaskRecord = async (task: Omit<TaskReminder, 'id' | 'createdAt'>): Promise<void> => {
  try {
    const taskData = {
      title: task.title,
      type: task.type,
      amount: task.amount,
      note: task.note || '',
      dueDate: task.dueDate.toISOString(),
      completed: task.completed
    };

    const response = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ task: taskData })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    console.log('Task added successfully via Vercel API');
  } catch (error) {
    console.error('Error adding task:', error);
    throw error;
  }
};

// Update task via Vercel API
export const updateTaskRecord = async (taskId: string, updates: Partial<TaskReminder>): Promise<void> => {
  try {
    const updateData: any = {};
    
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.note !== undefined) updateData.note = updates.note;
    if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate.toISOString();
    if (updates.completed !== undefined) updateData.completed = updates.completed;

    const response = await fetch(`${API_BASE}/tasks`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId, updates: updateData })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    console.log('Task updated successfully via Vercel API');
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};

// Delete task via Vercel API
export const deleteTaskRecord = async (taskId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/tasks?taskId=${taskId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    console.log('Task deleted successfully via Vercel API');
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

// Test connection to Vercel API
export const testConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
};

// Initialize Tasks sheet with headers
export const initializeTasksSheet = async (): Promise<void> => {
  try {
    const headers = [
      'ID', 'Title', 'Type', 'Amount', 'Note', 'DueDate', 'Completed', 'CreatedAt'
    ];

    const response = await fetch(`${API_BASE}/sheets?action=update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: 'Tasks!A1:H1',
        values: [headers]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to initialize Tasks sheet: ${errorData.error}`);
    }

    console.log('Tasks sheet initialized successfully via Vercel API');
  } catch (error) {
    console.error('Error initializing Tasks sheet:', error);
    throw new Error('Failed to initialize Tasks sheet');
  }
};