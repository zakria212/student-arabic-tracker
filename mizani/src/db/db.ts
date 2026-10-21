import Dexie, { type EntityTable } from 'dexie';
import type { Category, Receipt, Settings, Transaction } from './types';
import { DEFAULT_CATEGORIES } from './defaults';
import { DEFAULT_SETTINGS } from './types';

/** رقم إصدار بنية البيانات (يُكتب في النسخ الاحتياطية) */
export const DATA_SCHEMA_VERSION = 1;

export class MizaniDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  receipts!: EntityTable<Receipt, 'id'>;
  settings!: EntityTable<Settings, 'key'>;

  constructor(name = 'mizani') {
    super(name);
    this.version(1).stores({
      transactions: 'id, type, date, categoryId, paymentMethod, [type+date]',
      categories: 'id, type, order',
      receipts: 'id, transactionId',
      settings: 'key',
    });
    // البيانات الأساسية فقط (تصنيفات وإعدادات) — لا بيانات تجريبية للمستخدم
    this.on('populate', (tx) => {
      tx.table('categories').bulkAdd(DEFAULT_CATEGORIES);
      tx.table('settings').add(DEFAULT_SETTINGS);
    });
  }
}

export const db = new MizaniDB();
