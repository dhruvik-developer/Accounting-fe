export type WarehouseStatus = 'active' | 'inactive' | 'archived';

export type Warehouse = {
  id: string;
  warehouse_code: string;
  warehouse_name: string;
  branch_id: string | null;
  branch_name?: string;             // denormalised for list display
  manager_name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: WarehouseStatus;
  opening_stock_value: number;
  is_default: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type WarehouseInput = Omit<Warehouse, 'id' | 'created_at' | 'updated_at' | 'branch_name'>;
