import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, AlertTriangle, Eye } from 'lucide-react';
import DataTable from '../Common/Table/DataTable';
import LoadingSpinner from '../Loading/LoadingSpinner';
import ProductDetailModal from './ProductDetailModal';
import ConfirmationModal from '../Common/Modal/ConfirmationModal';
import { debounce } from 'lodash';

interface Product {
  _id: string;
  name: string;
  productCode: string;
  description: string;
  size: string;
  color: string;
  price: number;
  category: string;
  images: string[];
  createdAt: string;
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
  createdAt: string;
}

interface ConfirmationConfig {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  itemToDelete?: Stock;
  onConfirm: () => void;
}

const StockList = () => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockToEdit, setStockToEdit] = useState<Stock | null>(null);
  
  const [confirmation, setConfirmation] = useState<ConfirmationConfig>({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    onConfirm: () => {}
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchStocks = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch('http://localhost:3000/stock/all-stocks', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch stocks');
        }
        
        const data = await response.json();
        
        if (data.status === 'SUCCESS') {
          setStocks(data.data);
          setFilteredStocks(data.data);
        } else {
          throw new Error(data.message || 'Unknown error occurred');
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStocks();
  }, [token]);

  const handleProductView = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleEdit = (stock: Stock) => {
    setStockToEdit(stock);
    // You would implement an edit form similar to how it's done in ProductList
  };

  const handleDelete = (stock: Stock) => {
    setConfirmation({
      isOpen: true,
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete stock for "${stock.product.name}" (${stock.batchNumber})? This action can be reversed later.`,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      itemToDelete: stock,
      onConfirm: () => performDelete(stock)
    });
  };

  const performDelete = async (stock: Stock) => {
    try {
      const response = await fetch(`http://localhost:3000/stock/delete-stock/${stock._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete stock');
      }
      
      setStocks(prev => prev.filter(s => s._id !== stock._id));
      setFilteredStocks(prev => prev.filter(s => s._id !== stock._id));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      closeConfirmationModal();
    }
  };

  const closeConfirmationModal = () => {
    setConfirmation(prev => ({ ...prev, isOpen: false }));
  };

  const handleSearch = debounce((query: string) => {
    setFilteredStocks(
      stocks.filter(stock =>
        stock.product.name.toLowerCase().includes(query.toLowerCase()) ||
        stock.product.productCode.toLowerCase().includes(query.toLowerCase()) ||
        stock.batchNumber.toLowerCase().includes(query.toLowerCase()) ||
        stock.supplier.toLowerCase().includes(query.toLowerCase())
      )
    );
  }, 300);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    handleSearch(query);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const columns = [
    {
      header: '#',
      accessor: (_item: Stock, index: number) => index + 1
    },
    { header: 'Batch Number', accessor: (item: Stock) => item.batchNumber },
    { 
      header: 'Product', 
      accessor: (item: Stock) => (
        <div className="flex items-center">
          {item.product.name}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleProductView(item.product);
            }}
            className="ml-2 text-indigo-600 hover:text-indigo-800"
          >
            <Eye size={16} />
          </button>
        </div>
      ) 
    },
    { header: 'Size', accessor: (item: Stock) => item.size },
    { 
      header: 'Quantity', 
      accessor: (item: Stock) => (
        <span className={item.quantity <= item.lowStockAlert ? 'text-red-600 font-medium' : ''}>
          {item.quantity}
        </span>
      ) 
    },
    { 
      header: 'Price', 
      accessor: (item: Stock) => (
        <span>
          ${(item.price / 100).toFixed(2)}
        </span>
      ) 
    },
    { header: 'Supplier', accessor: (item: Stock) => item.supplier },
    { 
      header: 'Last Restocked', 
      accessor: (item: Stock) => formatDate(item.lastRestocked) 
    }
  ];

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
                placeholder="Search stocks..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>Add Stock</span>
            </motion.button>
          </div>

          {!error && filteredStocks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No stocks found. Add a new stock to get started.</p>
            </div>
          ) : !error ? (
            <DataTable
              columns={columns}
              data={filteredStocks}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : null}

          <AnimatePresence>
            {selectedProduct && (
              <ProductDetailModal
                product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
              />
            )}
          </AnimatePresence>

          <ConfirmationModal
            isOpen={confirmation.isOpen}
            title={confirmation.title}
            message={confirmation.message}
            confirmButtonText={confirmation.confirmButtonText}
            cancelButtonText={confirmation.cancelButtonText}
            onConfirm={confirmation.onConfirm}
            onCancel={closeConfirmationModal}
          />
        </>
      )}
    </div>
  );
};

export default StockList;