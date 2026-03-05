import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Utensils, 
  Coffee, 
  Shirt, 
  ShoppingCart, 
  ChevronLeft, 
  Plus, 
  Minus, 
  Check, 
  Clock, 
  Settings, 
  LayoutDashboard,
  Trash2,
  Edit,
  X,
  MapPin,
  Bell
} from 'lucide-react';
import { io } from 'socket.io-client';
import { Category, MenuItem, Order, OrderItem, Settings as HotelSettings } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const socket = io();

const LANGUAGES = {
  fa: { name: 'فارسی', dir: 'rtl' },
  en: { name: 'English', dir: 'ltr' },
  ar: { name: 'العربية', dir: 'rtl' },
  tr: { name: 'Türkçe', dir: 'ltr' },
  ku: { name: 'کوردی', dir: 'rtl' }
};

const UI_STRINGS: Record<string, Record<string, string>> = {
  welcome: { fa: 'خوش آمدید', en: 'Welcome', ar: 'أهلاً بك', tr: 'Hoş geldiniz', ku: 'بەخێربێن' },
  select_service: { fa: 'لطفاً سرویس مورد نظر خود را انتخاب کنید', en: 'Please select a service', ar: 'يرجى اختيار الخدمة', tr: 'Lütfen یک سرویس انتخاب کنید', ku: 'تکایە خزمەتگوزارییەک هەڵبژێرە' },
  location: { fa: 'موقعیت شما', en: 'Your Location', ar: 'موقعك', tr: 'Konumunuz', ku: 'شوێنی تۆ' },
  submit_order: { fa: 'ثبت سفارش', en: 'Submit Order', ar: 'إرسال الطلب', tr: 'Siparişi Gönder', ku: 'ناردنی داواکاری' },
  order_success: { fa: 'سفارش شما با موفقیت ثبت شد', en: 'Order submitted successfully', ar: 'تم ارسال طلبك بنجاح', tr: 'Siparişiniz başarıyla gönderildi', ku: 'داواکارییەکەت بە سەرکەوتوویی ناردرا' },
  items_selected: { fa: 'آیتم انتخاب شده', en: 'items selected', ar: 'عناصر مختارة', tr: 'öğe seçildi', ku: 'بڕگە هەڵبژێردراوە' },
  admin_panel: { fa: 'پنل مدیریت', en: 'Admin Panel', ar: 'لوحة التحكم', tr: 'Yönetici Paneli', ku: 'پەنێڵی بەڕێوەبردن' },
  hotel_sections: { fa: 'بخش‌های هتل', en: 'Hotel Sections', ar: 'أقسام الفندق', tr: 'Otel Bölümleri', ku: 'بەشەکانی هۆتێل' },
  manage_desc: { fa: 'مدیریت سفارشات و منوی هر بخش', en: 'Manage orders and menu', ar: 'إدارة الطلبات والمنيو', tr: 'Siparişleri ve menüyü yönet', ku: 'بەڕێوەبردنی داواکارییەکان و مینیو' },
  orders: { fa: 'سفارشات', en: 'Orders', ar: 'الطلبات', tr: 'Siparişler', ku: 'داواکارییەکان' },
  menu_mgmt: { fa: 'مدیریت منو', en: 'Menu Management', ar: 'إدارة المنيو', tr: 'Menü Yönetimi', ku: 'بەڕێوەبردنی مینیو' },
  settings: { fa: 'تنظیمات', en: 'Settings', ar: 'الإعدادات', tr: 'Ayarlar', ku: 'ڕێکخستنەکان' },
  hotel_name: { fa: 'نام هتل', en: 'Hotel Name', ar: 'اسم الفندق', tr: 'Otel Adı', ku: 'ناوی هۆتێل' },
  currency: { fa: 'واحد پول', en: 'Currency', ar: 'العملة', tr: 'Para Birimi', ku: 'دراو' },
  save: { fa: 'ذخیره تغییرات', en: 'Save Changes', ar: 'حفظ التغييرات', tr: 'Değişiklikleri Kaydet', ku: 'پاشەکەوتکردنی گۆڕانکارییەکان' },
  add_item: { fa: 'افزودن آیتم جدید', en: 'Add New Item', ar: 'إضافة عنصر جديد', tr: 'Yeni Öğe Ekle', ku: 'زیادکردنی بڕگەی نوێ' },
  status_pending: { fa: 'در انتظار', en: 'Pending', ar: 'قيد الانتظار', tr: 'Beklemede', ku: 'چاوەڕوان' },
  status_confirmed: { fa: 'تایید شده', en: 'Confirmed', ar: 'تم التأكيد', tr: 'Onaylandı', ku: 'پەسەندکراو' },
  status_completed: { fa: 'تکمیل شده', en: 'Completed', ar: 'مكتمل', tr: 'Tamamlandı', ku: 'تەواوکراو' },
  status_cancelled: { fa: 'لغو شده', en: 'Cancelled', ar: 'ملغي', tr: 'İptal edildi', ku: 'هەڵوەشاوەتەوە' },
};

const Navbar = ({ title, showBack = false, admin = false, lang, setLang }: { title: string, showBack?: boolean, admin?: boolean, lang: string, setLang: (l: string) => void }) => {
  const navigate = useNavigate();
  return (
    <nav className="sticky top-0 z-50 glass px-4 py-4 flex items-center justify-between border-b border-slate-200">
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={() => navigate(-1)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
            <ChevronLeft className={cn("w-6 h-6", LANGUAGES[lang as keyof typeof LANGUAGES].dir === 'rtl' ? 'rotate-180' : '')} />
          </button>
        )}
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <select 
          value={lang} 
          onChange={(e) => setLang(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none"
        >
          {Object.entries(LANGUAGES).map(([code, { name }]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
        {admin ? (
           <Link to="/admin/settings" className="p-2 text-slate-500 hover:text-indigo-600 transition-colors">
            <Settings className="w-5 h-5" />
          </Link>
        ) : (
          <Link to="/admin" className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <LayoutDashboard className="w-5 h-5" />
          </Link>
        )}
      </div>
    </nav>
  );
};

// --- Customer Views ---

const Home = ({ lang, setLang, settings }: { lang: string, setLang: (l: string) => void, settings: HotelSettings | null }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchParams] = useSearchParams();
  const location = searchParams.get('location') || '---';
  const t = (key: string) => UI_STRINGS[key][lang] || UI_STRINGS[key]['en'];

  useEffect(() => {
    fetch('/api/categories').then(res => res.json()).then(setCategories);
    document.body.dir = LANGUAGES[lang as keyof typeof LANGUAGES].dir;
  }, [lang]);

  const getIcon = (slug: string) => {
    switch (slug) {
      case 'restaurant': return <Utensils className="w-8 h-8" />;
      case 'cafe': return <Coffee className="w-8 h-8" />;
      case 'laundry': return <Shirt className="w-8 h-8" />;
      default: return <Utensils className="w-8 h-8" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar title={settings?.hotel_name || 'Hills Hotel'} lang={lang} setLang={setLang} />
      <main className="p-6 max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-4">
            <MapPin className="w-4 h-4" />
            {t('location')}: {location}
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">{t('welcome')}</h2>
          <p className="text-slate-500">{t('select_service')}</p>
        </div>

        <div className="grid gap-4">
          {categories.map((cat) => (
            <Link 
              key={cat.id} 
              to={`/menu/${cat.slug}?location=${location}`}
              className="group relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all flex items-center gap-6"
            >
              <div className="w-16 h-16 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                {getIcon(cat.slug)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">{cat.name}</h3>
                <p className="text-slate-500 text-sm">{t('menu_mgmt')}</p>
              </div>
              <ChevronLeft className={cn("w-5 h-5 mr-auto text-slate-300 group-hover:text-indigo-600 transition-colors", LANGUAGES[lang as keyof typeof LANGUAGES].dir === 'rtl' ? '' : 'rotate-180')} />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

const Menu = ({ lang, setLang, settings }: { lang: string, setLang: (l: string) => void, settings: HotelSettings | null }) => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const location = searchParams.get('location') || '---';
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const navigate = useNavigate();
  const t = (key: string) => UI_STRINGS[key][lang] || UI_STRINGS[key]['en'];

  useEffect(() => {
    fetch(`/api/menu/${slug}`).then(res => res.json()).then(setItems);
    fetch('/api/categories').then(res => res.json()).then(setCategories);
  }, [slug]);

  const currentCategory = categories.find(c => c.slug === slug);

  const updateCart = (id: number, delta: number) => {
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const cartCount: number = (Object.values(cart) as number[]).reduce((a: number, b: number) => a + b, 0);
  const totalPrice: number = items.reduce((sum: number, item: MenuItem) => sum + (item.price * (cart[item.id] || 0)), 0);

  const handleOrder = async () => {
    if (cartCount === 0) return;
    
    const orderItems = items
      .filter(item => cart[item.id])
      .map(item => ({
        id: item.id,
        name: item.translations?.name?.[lang] || item.name,
        price: item.price,
        quantity: cart[item.id]
      }));

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: currentCategory?.id,
        location,
        items: orderItems,
        total_price: totalPrice,
        currency: settings?.currency
      })
    });

    if (res.ok) {
      alert(t('order_success'));
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <Navbar title={currentCategory?.name || 'Menu'} showBack lang={lang} setLang={setLang} />
      
      <main className="p-4 max-w-2xl mx-auto">
        <div className="grid gap-4">
          {items.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4">
              <img 
                src={item.image_url || 'https://picsum.photos/seed/food/200'} 
                alt={item.name}
                className="w-24 h-24 rounded-xl object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">{item.translations?.name?.[lang] || item.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{item.translations?.description?.[lang] || item.description}</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-indigo-600">{totalPrice.toLocaleString()} {settings?.currency}</span>
                  <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1">
                    <button onClick={() => updateCart(item.id, -1)} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Minus className="w-4 h-4" /></button>
                    <span className="w-4 text-center font-medium">{cart[item.id] || 0}</span>
                    <button onClick={() => updateCart(item.id, 1)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-6 left-4 right-4 max-w-2xl mx-auto z-50">
            <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><ShoppingCart className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-white/70">{cartCount} {t('items_selected')}</p>
                  <p className="font-bold text-lg">{totalPrice.toLocaleString()} {settings?.currency}</p>
                </div>
              </div>
              <button onClick={handleOrder} className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors">{t('submit_order')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Admin Views ---

const AdminDashboard = ({ lang, setLang }: { lang: string, setLang: (l: string) => void }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const t = (key: string) => UI_STRINGS[key][lang] || UI_STRINGS[key]['en'];

  useEffect(() => {
    fetch('/api/categories').then(res => res.json()).then(setCategories);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar title={t('admin_panel')} admin lang={lang} setLang={setLang} />
      <main className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">{t('hotel_sections')}</h2>
          <p className="text-slate-500">{t('manage_desc')}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {categories.map(cat => (
            <div key={cat.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                {cat.slug === 'restaurant' ? <Utensils /> : cat.slug === 'cafe' ? <Coffee /> : <Shirt />}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-4">{cat.name}</h3>
              <div className="grid gap-2">
                <Link to={`/admin/orders/${cat.slug}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all group">
                  <span className="font-medium">{t('orders')}</span>
                  <LayoutDashboard className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                </Link>
                <Link to={`/admin/menu/${cat.slug}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all group">
                  <span className="font-medium">{t('menu_mgmt')}</span>
                  <Settings className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

const AdminOrders = ({ lang, setLang, settings }: { lang: string, setLang: (l: string) => void, settings: HotelSettings | null }) => {
  const { slug } = useParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const t = (key: string) => UI_STRINGS[key][lang] || UI_STRINGS[key]['en'];

  const fetchOrders = () => {
    fetch(`/api/admin/orders/${slug}`).then(res => res.json()).then(setOrders);
  };

  useEffect(() => {
    fetchOrders();
    fetch('/api/categories').then(res => res.json()).then(setCategories);
    socket.on('new_order', (order) => {
      const cat = categories.find(c => c.id === order.category_id);
      if (cat?.slug === slug) fetchOrders();
    });
    return () => { socket.off('new_order'); };
  }, [slug, categories]);

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/admin/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchOrders();
  };

  const currentCategory = categories.find(c => c.slug === slug);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar title={`${t('orders')} ${currentCategory?.name || ''}`} showBack admin lang={lang} setLang={setLang} />
      <main className="p-6 max-w-4xl mx-auto">
        <div className="grid gap-6">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm"><MapPin className="w-5 h-5 text-indigo-600" /></div>
                  <div>
                    <p className="text-xs text-slate-500">{t('location')}</p>
                    <p className="font-bold text-slate-800">{order.location}</p>
                  </div>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold uppercase",
                  order.status === 'pending' && "bg-amber-100 text-amber-700",
                  order.status === 'confirmed' && "bg-blue-100 text-blue-700",
                  order.status === 'completed' && "bg-emerald-100 text-emerald-700",
                  order.status === 'cancelled' && "bg-red-100 text-red-700",
                )}>
                  {t(`status_${order.status}`)}
                </div>
              </div>
              <div className="p-4">
                <div className="space-y-2 mb-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-slate-600">{item.name} x {item.quantity}</span>
                      <span className="font-medium">{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500">{t('total_price')}</p>
                    <p className="text-lg font-bold text-indigo-600">{order.total_price.toLocaleString()} {settings?.currency}</p>
                  </div>
                  <div className="flex gap-2">
                    {order.status === 'pending' && <button onClick={() => updateStatus(order.id, 'confirmed')} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Check className="w-5 h-5" /></button>}
                    {order.status === 'confirmed' && <button onClick={() => updateStatus(order.id, 'completed')} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"><Check className="w-5 h-5" /></button>}
                    {order.status !== 'completed' && order.status !== 'cancelled' && <button onClick={() => updateStatus(order.id, 'cancelled')} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"><X className="w-5 h-5" /></button>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

const AdminMenu = ({ lang, setLang, settings }: { lang: string, setLang: (l: string) => void, settings: HotelSettings | null }) => {
  const { slug } = useParams();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const t = (key: string) => UI_STRINGS[key][lang] || UI_STRINGS[key]['en'];

  const fetchItems = () => {
    fetch(`/api/admin/menu/${slug}`).then(res => res.json()).then(setItems);
  };

  useEffect(() => {
    fetchItems();
    fetch('/api/categories').then(res => res.json()).then(setCategories);
  }, [slug]);

  const currentCategory = categories.find(c => c.slug === slug);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingItem?.id ? 'PUT' : 'POST';
    const url = editingItem?.id ? `/api/admin/menu/${editingItem.id}` : '/api/admin/menu';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editingItem, category_id: currentCategory?.id })
    });
    if (res.ok) { setIsModalOpen(false); setEditingItem(null); fetchItems(); }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar title={`${t('menu_mgmt')} ${currentCategory?.name || ''}`} showBack admin lang={lang} setLang={setLang} />
      <main className="p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">{t('items_selected')}</h2>
          <button onClick={() => { setEditingItem({ name: '', description: '', price: 0, image_url: '', available: 1 }); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors"><Plus className="w-5 h-5" />{t('add_item')}</button>
        </div>
        <div className="grid gap-4">
          {items.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <img src={item.image_url || 'https://picsum.photos/seed/food/200'} alt={item.name} className="w-16 h-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
              <div className="flex-1">
                <h3 className="font-bold text-slate-800">{item.translations?.name?.[lang] || item.name}</h3>
                <p className="text-sm text-indigo-600 font-medium">{item.price.toLocaleString()} {settings?.currency}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Edit className="w-5 h-5" /></button>
                <button onClick={async () => { if (confirm('?')) { await fetch(`/api/admin/menu/${item.id}`, { method: 'DELETE' }); fetchItems(); } }} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-5 h-5" /></button>
              </div>
            </div>
          ))}
        </div>
      </main>
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editingItem?.id ? t('save') : t('add_item')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <input type="text" required value={editingItem?.name} onChange={e => setEditingItem(prev => ({ ...prev!, name: e.target.value }))} className="w-full px-4 py-2 rounded-xl border border-slate-200" placeholder="Name (Persian)" />
              <textarea value={editingItem?.description} onChange={e => setEditingItem(prev => ({ ...prev!, description: e.target.value }))} className="w-full px-4 py-2 rounded-xl border border-slate-200 h-24" placeholder="Description (Persian)" />
              <input type="number" required value={editingItem?.price} onChange={e => setEditingItem(prev => ({ ...prev!, price: Number(e.target.value) }))} className="w-full px-4 py-2 rounded-xl border border-slate-200" placeholder="Price" />
              <input type="text" value={editingItem?.image_url} onChange={e => setEditingItem(prev => ({ ...prev!, image_url: e.target.value }))} className="w-full px-4 py-2 rounded-xl border border-slate-200" placeholder="Image URL" />
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">{t('save')}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminSettings = ({ lang, setLang, settings, fetchSettings }: { lang: string, setLang: (l: string) => void, settings: HotelSettings | null, fetchSettings: () => void }) => {
  const [hotelName, setHotelName] = useState(settings?.hotel_name || '');
  const [currency, setCurrency] = useState(settings?.currency || 'IQD');
  const t = (key: string) => UI_STRINGS[key][lang] || UI_STRINGS[key]['en'];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotel_name: hotelName, currency })
    });
    fetchSettings();
    alert(t('order_success'));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar title={t('settings')} showBack admin lang={lang} setLang={setLang} />
      <main className="p-6 max-w-2xl mx-auto">
        <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('hotel_name')}</label>
            <input type="text" value={hotelName} onChange={e => setHotelName(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('currency')}</label>
            <select value={currency} onChange={e => setCurrency(e.target.value as any)} className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="IQD">IQD (دینار عراقی)</option>
              <option value="USD">USD (دلار آمریکا)</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors">{t('save')}</button>
        </form>
      </main>
    </div>
  );
};

export default function App() {
  const [lang, setLang] = useState('fa');
  const [settings, setSettings] = useState<HotelSettings | null>(null);

  const fetchSettings = () => {
    fetch('/api/settings').then(res => res.json()).then(setSettings);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home lang={lang} setLang={setLang} settings={settings} />} />
        <Route path="/menu/:slug" element={<Menu lang={lang} setLang={setLang} settings={settings} />} />
        <Route path="/admin" element={<AdminDashboard lang={lang} setLang={setLang} />} />
        <Route path="/admin/orders/:slug" element={<AdminOrders lang={lang} setLang={setLang} settings={settings} />} />
        <Route path="/admin/menu/:slug" element={<AdminMenu lang={lang} setLang={setLang} settings={settings} />} />
        <Route path="/admin/settings" element={<AdminSettings lang={lang} setLang={setLang} settings={settings} fetchSettings={fetchSettings} />} />
      </Routes>
    </BrowserRouter>
  );
}
