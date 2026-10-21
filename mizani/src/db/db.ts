import Dexie, { type EntityTable } from 'dexie';
import type { Category, Debt, DebtPayment, Receipt, Section, Settings, Transaction } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_SECTIONS } from './defaults';
import { DEFAULT_SETTINGS } from './types';

/** رقم إصدار بنية البيانات (يُكتب في النسخ الاحتياطية) */
export const DATA_SCHEMA_VERSION = 2;

export class MizaniDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  receipts!: EntityTable<Receipt, 'id'>;
  settings!: EntityTable<Settings, 'key'>;
  sections!: EntityTable<Section, 'id'>;
  debts!: EntityTable<Debt, 'id'>;
  debtPayments!: EntityTable<DebtPayment, 'id'>;

  constructor(name = 'mizani') {
    super(name);
    this.version(1).stores({
      transactions: 'id, type, date, categoryId, paymentMethod, [type+date]',
      categories: 'id, type, order',
      receipts: 'id, transactionId',
      settings: 'key',
    });
    // الإصدار 2: الأقسام والديون
    this.version(2)
      .stores({
        transactions: 'id, type, date, categoryId, paymentMethod, sectionId, [type+date]',
        sections: 'id, order',
        debts: 'id, direction, date, person',
        debtPayments: 'id, debtId, date',
      })
      .upgrade((tx) => tx.table('sections').bulkAdd(DEFAULT_SECTIONS));
    // البيانات الأساسية فقط (تصنيفات وإعدادات) — لا بيانات تجريبية للمستخدم
    this.on('populate', (tx) => {
      tx.table('categories').bulkAdd(DEFAULT_CATEGORIES);
      tx.table('settings').add(DEFAULT_SETTINGS);
      tx.table('sections').bulkAdd(DEFAULT_SECTIONS);
    });
  }
}

export const db = new MizaniDB();
