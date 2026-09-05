import fs from 'fs';
import path from 'path';

const uploadsDir = path.join(process.cwd(), 'uploads');
const productsDir = path.join(uploadsDir, 'products');
const receiptsDir = path.join(uploadsDir, 'receipts');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(productsDir)) fs.mkdirSync(productsDir, { recursive: true });
if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

const dbPath = path.join(process.cwd(), 'database', 'biznes_data.json');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

function loadData() {
  if (!fs.existsSync(dbPath)) {
    const initialData = {
      products: [],
      orders: [],
      expenses: [],
      goals: []
    };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), 'utf8');
    return initialData;
  }
  try {
    const content = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return { products: [], orders: [], expenses: [], goals: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

function getLocalDateString(offsetDays = 0) {
  const d = new Date();
  if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function getLocalDateTimeString() {
  const d = new Date();
  const dateStr = d.toLocaleDateString('sv-SE');
  const timeStr = d.toTimeString().split(' ')[0];
  return `${dateStr} ${timeStr}`;
}

class PreparedStatement {
  constructor(sql) {
    this.sql = sql.trim();
  }

  run(...params) {
    const data = loadData();
    const sql = this.sql;

    // INSERT INTO products
    if (/^INSERT INTO products/i.test(sql)) {
      const [name, description, category, purchase_price, selling_price, stock_quantity, image_url] = params;
      const id = (data.products.length ? Math.max(...data.products.map(p => p.id)) : 0) + 1;
      const newProduct = {
        id,
        name: name || '',
        description: description || '',
        category: category || 'erkaklar_kiyimlari',
        purchase_price: Number(purchase_price) || 0,
        selling_price: Number(selling_price) || 0,
        stock_quantity: Number(stock_quantity) || 0,
        image_url: image_url || null,
        is_active: 1,
        created_at: getLocalDateTimeString(),
        updated_at: getLocalDateTimeString()
      };
      data.products.push(newProduct);
      saveData(data);
      return { lastInsertRowid: id, changes: 1 };
    }

    // UPDATE products (image_url bilan yoki usiz)
    if (/^UPDATE products\s+SET/i.test(sql)) {
      if (/stock_quantity\s*=\s*stock_quantity\s*-\s*\?/i.test(sql)) {
        const [qty, id] = params;
        const p = data.products.find(x => x.id === Number(id));
        if (p) {
          p.stock_quantity = Math.max(0, p.stock_quantity - Number(qty));
          p.updated_at = getLocalDateTimeString();
          saveData(data);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (/stock_quantity\s*=\s*stock_quantity\s*\+\s*\?/i.test(sql)) {
        const [qty, id] = params;
        const p = data.products.find(x => x.id === Number(id));
        if (p) {
          p.stock_quantity += Number(qty);
          p.updated_at = getLocalDateTimeString();
          saveData(data);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (/is_active\s*=\s*0/i.test(sql)) {
        const [id] = params;
        const p = data.products.find(x => x.id === Number(id));
        if (p) {
          p.is_active = 0;
          p.updated_at = getLocalDateTimeString();
          saveData(data);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      // Oddiy update
      if (params.length === 8) {
        const [name, description, category, purchase_price, selling_price, stock_quantity, image_url, id] = params;
        const p = data.products.find(x => x.id === Number(id));
        if (p) {
          p.name = name;
          p.description = description;
          p.category = category;
          p.purchase_price = Number(purchase_price);
          p.selling_price = Number(selling_price);
          p.stock_quantity = Number(stock_quantity);
          p.image_url = image_url;
          p.updated_at = getLocalDateTimeString();
          saveData(data);
          return { changes: 1 };
        }
        return { changes: 0 };
      } else if (params.length === 7) {
        const [name, description, category, purchase_price, selling_price, stock_quantity, id] = params;
        const p = data.products.find(x => x.id === Number(id));
        if (p) {
          p.name = name;
          p.description = description;
          p.category = category;
          p.purchase_price = Number(purchase_price);
          p.selling_price = Number(selling_price);
          p.stock_quantity = Number(stock_quantity);
          p.updated_at = getLocalDateTimeString();
          saveData(data);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
    }

    // INSERT INTO orders
    if (/^INSERT INTO orders/i.test(sql)) {
      let [
        product_id, platform, quantity, unit_price, total_price, profit,
        paid_amount, debt_amount, customer_name, customer_phone,
        delivery_address, delivery_fee, status, order_date, note
      ] = params;

      const id = (data.orders.length ? Math.max(...data.orders.map(o => o.id)) : 0) + 1;
      const uPrice = Number(unit_price) || 0;
      const q = Number(quantity) || 1;
      const tPrice = total_price !== undefined ? Number(total_price) : (uPrice * q);
      const paid = paid_amount !== undefined ? Number(paid_amount) : tPrice;
      const debt = debt_amount !== undefined ? Number(debt_amount) : Math.max(0, tPrice - paid);

      const newOrder = {
        id,
        product_id: Number(product_id),
        platform: platform || 'uzum',
        quantity: q,
        unit_price: uPrice,
        total_price: tPrice,
        profit: Number(profit) || 0,
        paid_amount: paid,
        debt_amount: debt,
        customer_name: customer_name || '',
        customer_phone: customer_phone || '',
        delivery_address: delivery_address || '',
        delivery_fee: Number(delivery_fee) || 0,
        status: status || (debt > 0 ? 'qarzda' : 'yangi'),
        order_date: order_date || getLocalDateTimeString(),
        note: note || '',
        created_at: getLocalDateTimeString()
      };
      data.orders.push(newOrder);
      saveData(data);
      return { lastInsertRowid: id, changes: 1 };
    }

    // UPDATE orders
    if (/^UPDATE orders\s+SET/i.test(sql)) {
      // Pay debt update: paid_amount = ?, debt_amount = ?, status = ? WHERE id = ?
      if (/paid_amount\s*=\s*\?.*debt_amount\s*=\s*\?/i.test(sql) && params.length === 4) {
        const [paid_amount, debt_amount, status, id] = params;
        const o = data.orders.find(x => x.id === Number(id));
        if (o) {
          o.paid_amount = Number(paid_amount);
          o.debt_amount = Number(debt_amount);
          o.status = status;
          saveData(data);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (/status\s*=\s*\?\s*WHERE\s+id\s*=\s*\?/i.test(sql) && params.length === 2) {
        const [status, id] = params;
        const o = data.orders.find(x => x.id === Number(id));
        if (o) {
          o.status = status;
          saveData(data);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (params.length === 4) {
        const [customer_name, customer_phone, status, id] = params;
        const o = data.orders.find(x => x.id === Number(id));
        if (o) {
          o.customer_name = customer_name;
          o.customer_phone = customer_phone;
          o.status = status;
          saveData(data);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
    }

    // DELETE FROM orders
    if (/^DELETE FROM orders/i.test(sql)) {
      const [id] = params;
      const idx = data.orders.findIndex(x => x.id === Number(id));
      if (idx !== -1) {
        data.orders.splice(idx, 1);
        saveData(data);
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    // INSERT INTO expenses
    if (/^INSERT INTO expenses/i.test(sql)) {
      const [category, description, amount, receipt_image, location, expense_date] = params;
      const id = (data.expenses.length ? Math.max(...data.expenses.map(e => e.id)) : 0) + 1;
      const newExpense = {
        id,
        category: category || 'boshqa',
        description: description || '',
        amount: Number(amount) || 0,
        receipt_image: receipt_image || null,
        location: location || '',
        expense_date: expense_date || getLocalDateString(),
        created_at: getLocalDateTimeString()
      };
      data.expenses.push(newExpense);
      saveData(data);
      return { lastInsertRowid: id, changes: 1 };
    }

    // UPDATE expenses
    if (/^UPDATE expenses\s+SET/i.test(sql)) {
      if (params.length === 7) {
        const [category, description, amount, location, expense_date, receipt_image, id] = params;
        const e = data.expenses.find(x => x.id === Number(id));
        if (e) {
          e.category = category;
          e.description = description;
          e.amount = Number(amount);
          e.location = location;
          e.expense_date = expense_date;
          e.receipt_image = receipt_image;
          saveData(data);
          return { changes: 1 };
        }
        return { changes: 0 };
      } else if (params.length === 6) {
        const [category, description, amount, location, expense_date, id] = params;
        const e = data.expenses.find(x => x.id === Number(id));
        if (e) {
          e.category = category;
          e.description = description;
          e.amount = Number(amount);
          e.location = location;
          e.expense_date = expense_date;
          saveData(data);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
    }

    // DELETE FROM expenses
    if (/^DELETE FROM expenses/i.test(sql)) {
      const [id] = params;
      const idx = data.expenses.findIndex(x => x.id === Number(id));
      if (idx !== -1) {
        data.expenses.splice(idx, 1);
        saveData(data);
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    // INSERT INTO goals
    if (/^INSERT INTO goals/i.test(sql)) {
      const [title, target_amount, period, deadline] = params;
      const id = (data.goals.length ? Math.max(...data.goals.map(g => g.id)) : 0) + 1;
      const newGoal = {
        id,
        title: title || '',
        target_amount: Number(target_amount) || 0,
        current_amount: 0,
        period: period || 'monthly',
        deadline: deadline || '',
        is_completed: 0,
        created_at: getLocalDateTimeString()
      };
      data.goals.push(newGoal);
      saveData(data);
      return { lastInsertRowid: id, changes: 1 };
    }

    // UPDATE goals
    if (/^UPDATE goals\s+SET/i.test(sql)) {
      if (/current_amount\s*=\s*\?/i.test(sql)) {
        const [current_amount, is_completed, id] = params;
        const g = data.goals.find(x => x.id === Number(id));
        if (g) {
          g.current_amount = Number(current_amount);
          g.is_completed = Number(is_completed);
          saveData(data);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (params.length === 6) {
        const [title, target_amount, period, deadline, is_completed, id] = params;
        const g = data.goals.find(x => x.id === Number(id));
        if (g) {
          g.title = title;
          g.target_amount = Number(target_amount);
          g.period = period;
          g.deadline = deadline;
          g.is_completed = Number(is_completed);
          saveData(data);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
    }

    // DELETE FROM goals
    if (/^DELETE FROM goals/i.test(sql)) {
      const [id] = params;
      const idx = data.goals.findIndex(x => x.id === Number(id));
      if (idx !== -1) {
        data.goals.splice(idx, 1);
        saveData(data);
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    return { changes: 0 };
  }

  get(...params) {
    const allResults = this.all(...params);
    return allResults.length > 0 ? allResults[0] : null;
  }

  all(...params) {
    const data = loadData();
    const sql = this.sql;

    // SELECT single product by id
    if (/^SELECT \* FROM products WHERE id = \?/i.test(sql) || /^SELECT purchase_price, selling_price, stock_quantity FROM products WHERE id = \?/i.test(sql)) {
      const id = Number(params[0]);
      const p = data.products.find(x => x.id === id);
      return p ? [p] : [];
    }

    // SELECT all products
    if (/^SELECT \* FROM products/i.test(sql)) {
      let list = data.products.filter(p => p.is_active === 1);
      if (/name LIKE \?/i.test(sql)) {
        const search = (params[0] || '').replace(/%/g, '').toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(search));
      }
      return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // SELECT product order stats
    if (/SELECT platform, COUNT\(\*\) as order_count, SUM\(quantity\) as total_sold FROM orders WHERE product_id = \?/i.test(sql)) {
      const productId = Number(params[0]);
      const productOrders = data.orders.filter(o => o.product_id === productId);
      const platforms = ['uzum', 'telegram', 'instagram'];
      const stats = [];
      for (const pf of platforms) {
        const match = productOrders.filter(o => o.platform === pf);
        if (match.length > 0) {
          stats.push({
            platform: pf,
            order_count: match.length,
            total_sold: match.reduce((s, o) => s + (o.quantity || 0), 0)
          });
        }
      }
      return stats;
    }

    // SELECT single order
    if (/^SELECT product_id, quantity FROM orders WHERE id = \?/i.test(sql)) {
      const id = Number(params[0]);
      const o = data.orders.find(x => x.id === id);
      return o ? [o] : [];
    }

    // SELECT single order by id (full)
    if (/^SELECT \* FROM orders WHERE id = \?/i.test(sql)) {
      const id = Number(params[0]);
      const o = data.orders.find(x => x.id === id);
      return o ? [o] : [];
    }

    // SELECT orders list with join
    if (/FROM orders o\s+(LEFT\s+)?JOIN products p ON o\.product_id = p\.id/i.test(sql)) {
      let list = data.orders.map(o => {
        const p = data.products.find(x => x.id === o.product_id) || {};
        return {
          ...o,
          product_name: p.name || 'Noma\'lum',
          image_url: p.image_url || null,
          base_purchase_price: p.purchase_price || 0
        };
      });

      // Filter platform
      if (/o\.platform = \?/i.test(sql)) {
        const pf = params.shift();
        list = list.filter(o => o.platform === pf);
      }
      // Filter status
      if (/o\.status = \?/i.test(sql)) {
        const st = params.shift();
        list = list.filter(o => o.status === st);
      }
      // Filter debt
      if (/o\.debt_amount > 0/i.test(sql)) {
        list = list.filter(o => (Number(o.debt_amount) || 0) > 0);
      }
      // Filter period
      const now = new Date();
      if (/7 days/i.test(sql)) {
        const cutoff = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        list = list.filter(o => new Date(o.order_date) >= cutoff);
      } else if (/15 days/i.test(sql)) {
        const cutoff = new Date(now.getTime() - 15 * 24 * 3600 * 1000);
        list = list.filter(o => new Date(o.order_date) >= cutoff);
      } else if (/1 month/i.test(sql)) {
        const cutoff = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
        list = list.filter(o => new Date(o.order_date) >= cutoff);
      } else if (/6 months/i.test(sql)) {
        const cutoff = new Date(now.getTime() - 180 * 24 * 3600 * 1000);
        list = list.filter(o => new Date(o.order_date) >= cutoff);
      } else if (/1 year/i.test(sql)) {
        const cutoff = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
        list = list.filter(o => new Date(o.order_date) >= cutoff);
      }

      list.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

      if (/LIMIT 10/i.test(sql)) {
        return list.slice(0, 10);
      }
      return list;
    }

    // SELECT orders stats by platform
    if (/SELECT platform, COUNT\(\*\) as order_count, SUM\(total_price\) as total_revenue, SUM\(profit\) as total_profit\s+FROM orders/i.test(sql)) {
      let list = [...data.orders];
      const now = new Date();
      if (/7 days/i.test(sql)) {
        list = list.filter(o => new Date(o.order_date) >= new Date(now.getTime() - 7 * 24 * 3600 * 1000));
      } else if (/15 days/i.test(sql)) {
        list = list.filter(o => new Date(o.order_date) >= new Date(now.getTime() - 15 * 24 * 3600 * 1000));
      } else if (/1 month/i.test(sql)) {
        list = list.filter(o => new Date(o.order_date) >= new Date(now.getTime() - 30 * 24 * 3600 * 1000));
      } else if (/6 months/i.test(sql)) {
        list = list.filter(o => new Date(o.order_date) >= new Date(now.getTime() - 180 * 24 * 3600 * 1000));
      } else if (/1 year/i.test(sql)) {
        list = list.filter(o => new Date(o.order_date) >= new Date(now.getTime() - 365 * 24 * 3600 * 1000));
      }

      const platforms = ['uzum', 'telegram', 'instagram'];
      const stats = [];
      for (const pf of platforms) {
        const subset = list.filter(o => o.platform === pf);
        stats.push({
          platform: pf,
          order_count: subset.length,
          total_revenue: subset.reduce((s, o) => s + (o.total_price || 0), 0),
          total_profit: subset.reduce((s, o) => s + (o.profit || 0), 0)
        });
      }
      return stats;
    }

    // SELECT expenses list
    if (/^SELECT \* FROM expenses/i.test(sql)) {
      let list = [...data.expenses];
      if (/category = \?/i.test(sql)) {
        const cat = params.shift();
        list = list.filter(e => e.category === cat);
      }
      const now = new Date();
      if (/7 days/i.test(sql)) {
        list = list.filter(e => new Date(e.expense_date) >= new Date(now.getTime() - 7 * 24 * 3600 * 1000));
      } else if (/15 days/i.test(sql)) {
        list = list.filter(e => new Date(e.expense_date) >= new Date(now.getTime() - 15 * 24 * 3600 * 1000));
      } else if (/1 month/i.test(sql)) {
        list = list.filter(e => new Date(e.expense_date) >= new Date(now.getTime() - 30 * 24 * 3600 * 1000));
      } else if (/6 months/i.test(sql)) {
        list = list.filter(e => new Date(e.expense_date) >= new Date(now.getTime() - 180 * 24 * 3600 * 1000));
      } else if (/1 year/i.test(sql)) {
        list = list.filter(e => new Date(e.expense_date) >= new Date(now.getTime() - 365 * 24 * 3600 * 1000));
      }

      return list.sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));
    }

    // SELECT expenses stats by category
    if (/SELECT category, COUNT\(\*\) as expense_count, SUM\(amount\) as total_amount\s+FROM expenses/i.test(sql)) {
      let list = [...data.expenses];
      const now = new Date();
      if (/7 days/i.test(sql)) {
        list = list.filter(e => new Date(e.expense_date) >= new Date(now.getTime() - 7 * 24 * 3600 * 1000));
      } else if (/15 days/i.test(sql)) {
        list = list.filter(e => new Date(e.expense_date) >= new Date(now.getTime() - 15 * 24 * 3600 * 1000));
      } else if (/1 month/i.test(sql)) {
        list = list.filter(e => new Date(e.expense_date) >= new Date(now.getTime() - 30 * 24 * 3600 * 1000));
      } else if (/6 months/i.test(sql)) {
        list = list.filter(e => new Date(e.expense_date) >= new Date(now.getTime() - 180 * 24 * 3600 * 1000));
      } else if (/1 year/i.test(sql)) {
        list = list.filter(e => new Date(e.expense_date) >= new Date(now.getTime() - 365 * 24 * 3600 * 1000));
      }

      const map = {};
      list.forEach(e => {
        if (!map[e.category]) map[e.category] = { category: e.category, expense_count: 0, total_amount: 0 };
        map[e.category].expense_count++;
        map[e.category].total_amount += Number(e.amount) || 0;
      });
      return Object.values(map);
    }

    // SELECT goals
    if (/^SELECT \* FROM goals/i.test(sql)) {
      let list = [...data.goals];
      if (/is_completed = 0/i.test(sql)) {
        list = list.filter(g => g.is_completed === 0);
      }
      return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // SELECT goal target_amount
    if (/SELECT target_amount FROM goals WHERE id = \?/i.test(sql)) {
      const id = Number(params[0]);
      const g = data.goals.find(x => x.id === id);
      return g ? [g] : [];
    }

    // DASHBOARD: today orders summary
    if (/total_orders.*revenue.*profit.*FROM orders.*order_date/is.test(sql)) {
      const todayStr = getLocalDateString();
      const todayOrders = data.orders.filter(o => (o.order_date || '').startsWith(todayStr));
      return [{
        total_orders: todayOrders.length,
        revenue: todayOrders.reduce((s, o) => s + (o.total_price || 0), 0),
        profit: todayOrders.reduce((s, o) => s + (o.profit || 0), 0)
      }];
    }

    // DASHBOARD: products summary
    if (/total_products.*low_stock_count/is.test(sql)) {
      const activeProducts = data.products.filter(p => p.is_active === 1);
      return [{
        total_products: activeProducts.length,
        low_stock_count: activeProducts.filter(p => p.stock_quantity < 5).length
      }];
    }

    // DASHBOARD: platform counts today
    if (/SELECT platform, COUNT\(\*\) as count\s+FROM orders\s+WHERE date\(order_date\) = date\('now'/i.test(sql)) {
      const todayStr = getLocalDateString();
      const todayOrders = data.orders.filter(o => (o.order_date || '').startsWith(todayStr));
      const platforms = ['uzum', 'telegram', 'instagram'];
      return platforms.map(pf => ({
        platform: pf,
        count: todayOrders.filter(o => o.platform === pf).length
      }));
    }

    // DASHBOARD: platform counts all time
    if (/SELECT platform, COUNT\(\*\) as count\s+FROM orders\s+GROUP BY platform/i.test(sql)) {
      const platforms = ['uzum', 'telegram', 'instagram'];
      return platforms.map(pf => ({
        platform: pf,
        count: data.orders.filter(o => o.platform === pf).length
      }));
    }

    // DASHBOARD: profit trend (30 days)
    if (/daily_profit.*FROM orders/is.test(sql)) {
      const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const map = {};
      data.orders.forEach(o => {
        const d = (o.order_date || '').split(' ')[0] || (o.order_date || '').split('T')[0];
        if (d && new Date(d) >= cutoff) {
          map[d] = (map[d] || 0) + (o.profit || 0);
        }
      });
      return Object.keys(map).sort().map(d => ({ date: d, daily_profit: map[d] }));
    }

    // DASHBOARD: top products
    if (/sold_count.*total_profit.*GROUP BY p\.id\s+ORDER BY sold_count DESC\s+LIMIT 5/is.test(sql)) {
      const map = {};
      data.orders.forEach(o => {
        const p = data.products.find(x => x.id === o.product_id);
        const name = p ? p.name : 'Mahsulot #' + o.product_id;
        if (!map[o.product_id]) map[o.product_id] = { name, sold_count: 0, total_profit: 0 };
        map[o.product_id].sold_count += (o.quantity || 0);
        map[o.product_id].total_profit += (o.profit || 0);
      });
      return Object.values(map).sort((a, b) => b.sold_count - a.sold_count).slice(0, 5);
    }

    // DASHBOARD: expenses sums
    if (/COALESCE\(SUM\(amount\), 0\) as total FROM expenses/i.test(sql)) {
      const todayStr = getLocalDateString();
      if (/expense_date = date\('now'/i.test(sql)) {
        const subset = data.expenses.filter(e => (e.expense_date || '').startsWith(todayStr));
        return [{ total: subset.reduce((s, e) => s + (e.amount || 0), 0) }];
      }
      if (/7 days/i.test(sql)) {
        const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
        const subset = data.expenses.filter(e => new Date(e.expense_date) >= cutoff);
        return [{ total: subset.reduce((s, e) => s + (e.amount || 0), 0) }];
      }
      if (/start of month/i.test(sql)) {
        const monthPrefix = todayStr.substring(0, 7); // YYYY-MM
        const subset = data.expenses.filter(e => (e.expense_date || '').startsWith(monthPrefix));
        return [{ total: subset.reduce((s, e) => s + (e.amount || 0), 0) }];
      }
      return [{ total: data.expenses.reduce((s, e) => s + (e.amount || 0), 0) }];
    }

    // DASHBOARD: total revenue all time
    if (/SELECT COALESCE\(SUM\(total_price\), 0\) as total FROM orders/i.test(sql)) {
      return [{ total: data.orders.reduce((s, o) => s + (o.total_price || 0), 0) }];
    }

    // DASHBOARD: streak distinct dates
    if (/SELECT DISTINCT date\(order_date\) as d FROM orders/i.test(sql)) {
      const set = new Set();
      data.orders.forEach(o => {
        const d = (o.order_date || '').split(' ')[0] || (o.order_date || '').split('T')[0];
        if (d) set.add(d);
      });
      return Array.from(set).sort().reverse().map(d => ({ d }));
    }

    return [];
  }
}

class FakeDatabase {
  pragma() {}
  exec() {}
  transaction(fn) {
    return fn;
  }
  prepare(sql) {
    return new PreparedStatement(sql);
  }
}

let dbInstance = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = new FakeDatabase();
  }
  return dbInstance;
}

