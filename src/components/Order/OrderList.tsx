import React, { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, Package, Check, Loader2 } from 'lucide-react';
import DataTable from '../Common/Table/DataTable';
import LoadingSpinner from '../Loading/LoadingSpinner';
import ConfirmationModal from '../Common/Modal/ConfirmationModal';
import { debounce } from 'lodash';
import ProductModal from './ProductModal';

interface Customer {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  address: string;
  city: string;
  state: string;
}

interface Product {
  _id: string;
  name: string;
  productCode: string;
  description: string;
  size: string;
  color: string;
  price: number;
  images: string[];
}

interface Stock {
  _id: string;
  product: Product;
  batchNumber: string;
  quantity: number;
  size: string;
  price: number;
  lowStockAlert: number;
  lastRestocked: string;
  supplier: string;
}

interface OrderItem {
  _id: string;
  stock: Stock;
  quantity: number;
}

interface Order {
  _id: string;
  customer: Customer;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  createdAt: string;
  deletedAt: number;
}

interface ConfirmationConfig {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  itemToDelete?: Order;
  onConfirm: () => void;
}

interface ProductModalState {
  isOpen: boolean;
  products: OrderItem[];
}

interface StatusUpdateState {
  [orderId: string]: {
    isLoading: boolean;
    error: string | null;
  };
}

const OrderList = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdateState>({});
  const [productModal, setProductModal] = useState<ProductModalState>({
    isOpen: false,
    products: []
  });
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [confirmation, setConfirmation] = useState<ConfirmationConfig>({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    onConfirm: () => {}
  });

  const token = localStorage.getItem('token');
  const orderStatusOptions = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('http://localhost:3000/order/all-orders', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }

        const result = await response.json();
        if (result.status === 'SUCCESS') {
          setOrders(result.data);
          setFilteredOrders(result.data);
        } else {
          throw new Error(result.message || 'Failed to fetch orders');
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [token]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    // Update local state to show loading
    setStatusUpdates(prev => ({
      ...prev,
      [orderId]: { isLoading: true, error: null }
    }));

    try {
      const response = await fetch(`http://localhost:3000/order/update-order/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update order status');
      }

      // Update order in state
      setOrders(prevOrders => prevOrders.map(order =>
        order._id === orderId ? { ...order, status: newStatus } : order
      ));

      setFilteredOrders(prevOrders => prevOrders.map(order =>
        order._id === orderId ? { ...order, status: newStatus } : order
      ));

      // Clear loading state
      setStatusUpdates(prev => ({
        ...prev,
        [orderId]: { isLoading: false, error: null }
      }));

      // Show success briefly
      setTimeout(() => {
        setStatusUpdates(prev => {
          const updated = { ...prev };
          delete updated[orderId];
          return updated;
        });
      }, 2000);

    } catch (error) {
      // Set error state
      setStatusUpdates(prev => ({
        ...prev,
        [orderId]: {
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to update status'
        }
      }));

      // Clear error after 3 seconds
      setTimeout(() => {
        setStatusUpdates(prev => {
          const updated = { ...prev };
          delete updated[orderId];
          return updated;
        });
      }, 3000);
    }
  };

  const columns = [
    {
      header: '#',
      accessor: (_item: Order, index: number) => index + 1
    },
    {
        header: 'Address',
        accessor: (item: Order) => (
          <div>
            <div className="text-sm">{item.customer.firstName} {item.customer.lastName}</div>
            <div className="text-xs">{item.customer.address}</div>
            <div className="text-xs text-gray-600">{item.customer.city}, {item.customer.state}</div>
          </div>
        )
      },
    {
      header: 'Contact',
      accessor: (item: Order) => (
        <div>
          {item.customer.email && <div className="text-xs text-gray-600">{item.customer.email}</div>}
          <div className="text-ms">{item.customer.phone}</div>
        </div>
      )
    },
    {
      header: 'Items',
      accessor: (item: Order) => (
        <div className="flex items-center">
          <span className="mr-2">{item.items.length}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewProducts(item.items);
            }}
            className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 flex items-center"
          >
            <Package size={16} className="mr-1" />
            <span>View</span>
          </button>
        </div>
      )
    },
    {
      header: 'Total Amount',
      accessor: (item: Order) => `$${(item.totalAmount / 100).toFixed(2)}`
    },
    {
      header: 'Status',
      accessor: (item: Order) => (
        <div className="flex items-center">
          <select
            aria-label="Order status"
            value={item.status}
            onChange={(e) => handleStatusChange(item._id, e.target.value)}
            className={`px-2 py-1 rounded text-sm font-medium border ${
              item.status === 'Pending' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' :
              item.status === 'Shipped' ? 'border-blue-300 bg-blue-50 text-blue-800' :
              item.status === 'Delivered' ? 'border-green-300 bg-green-50 text-green-800' :
              item.status === 'Cancelled' ? 'border-red-300 bg-red-50 text-red-800' :
              'border-gray-300 bg-gray-50 text-gray-800'
            }`}
            disabled={statusUpdates[item._id]?.isLoading}
          >
            {orderStatusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
  
          {statusUpdates[item._id]?.isLoading && (
            <Loader2 size={16} className="ml-2 animate-spin text-blue-500" />
          )}
  
          {statusUpdates[item._id] && !statusUpdates[item._id].isLoading && !statusUpdates[item._id].error && (
            <Check size={16} className="ml-2 text-green-500" />
          )}
  
          {statusUpdates[item._id]?.error && (
            <span className="ml-2 text-xs text-red-500">Failed</span>
          )}
        </div>
      )
    },
    {
      header: 'Created',
      accessor: (item: Order) => new Date(item.createdAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    },
  ];
  

  const handleViewProducts = (items: OrderItem[]) => {
    setProductModal({
      isOpen: true,
      products: items
    });
    setCurrentProductIndex(0);
    setCurrentImageIndex(0);
  };

  const closeProductModal = () => {
    setProductModal(prev => ({ ...prev, isOpen: false }));
  };

  const goToNextProduct = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (productModal.products.length > 1) {
      setCurrentProductIndex((prev) => (prev + 1) % productModal.products.length);
      setCurrentImageIndex(0);
    }
  };

  const goToPrevProduct = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (productModal.products.length > 1) {
      setCurrentProductIndex((prev) => (prev - 1 + productModal.products.length) % productModal.products.length);
      setCurrentImageIndex(0);
    }
  };

  const goToNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentProduct = productModal.products[currentProductIndex]?.stock.product;
    if (currentProduct && currentProduct.images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % currentProduct.images.length);
    }
  };

  const goToPrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentProduct = productModal.products[currentProductIndex]?.stock.product;
    if (currentProduct && currentProduct.images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + currentProduct.images.length) % currentProduct.images.length);
    }
  };

  const handleDelete = (order: Order) => {
    setConfirmation({
      isOpen: true,
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete order for "${order.customer.firstName} ${order.customer.lastName}"? This action can be reversed later.`,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      itemToDelete: order,
      onConfirm: () => performDelete(order)
    });
  };

  const performDelete = async (order: Order) => {
    try {
      const response = await fetch(`http://localhost:3000/order/delete-order/${order._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete order');
      }

      setOrders(prevOrders => prevOrders.filter(o => o._id !== order._id));
      setFilteredOrders(prevOrders => prevOrders.filter(o => o._id !== order._id));
      console.log('Order deleted successfully');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      closeConfirmationModal();
    }
  };

  const closeConfirmationModal = () => {
    setConfirmation(prev => ({ ...prev, isOpen: false }));
  };

  const handleSearch = useCallback(
    debounce((query: string) => {
      setFilteredOrders(
        orders.filter(order =>
          order.customer.firstName.toLowerCase().includes(query.toLowerCase()) ||
          order.customer.lastName.toLowerCase().includes(query.toLowerCase()) ||
          order.status.toLowerCase().includes(query.toLowerCase()) ||
          order.customer.email?.toLowerCase().includes(query.toLowerCase()) ||
          order.customer.phone.includes(query)
        )
      );
    }, 300),
    [orders]
  );

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    handleSearch(query);
  };

  return (
    <div className="p-6">
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 flex items-center">
              <AlertTriangle size={20} className="mr-2" />
              <span>{error}</span>
            </div>
          )}

          <div className="mb-6 flex items-center justify-end space-x-4">
            <div className="relative flex-grow max-w-md">
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            </div>
          </div>

          {!error && filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No orders found.</p>
            </div>
          ) : !error ? (
            <DataTable
              columns={columns}
              data={filteredOrders}
              onDelete={handleDelete}
            />
          ) : null}

          <ConfirmationModal
            isOpen={confirmation.isOpen}
            title={confirmation.title}
            message={confirmation.message}
            confirmButtonText={confirmation.confirmButtonText}
            cancelButtonText={confirmation.cancelButtonText}
            onConfirm={confirmation.onConfirm}
            onCancel={closeConfirmationModal}
          />

          {/* Product Modal */}
          <ProductModal
            isOpen={productModal.isOpen}
            products={productModal.products}
            currentProductIndex={currentProductIndex}
            currentImageIndex={currentImageIndex}
            onClose={closeProductModal}
            goToNextProduct={goToNextProduct}
            goToPrevProduct={goToPrevProduct}
            goToNextImage={goToNextImage}
            goToPrevImage={goToPrevImage}
          />
        </>
      )}
    </div>
  );
};

export default OrderList;
