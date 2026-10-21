import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('workspaces',{id:text('id').primaryKey(),data:text('data').notNull(),revision:integer('revision').notNull().default(0),expires:integer('expires').notNull()});
export const sessions=sqliteTable('sessions',{token:text('token').primaryKey(),workspace:text('workspace').notNull(),role:text('role').notNull(),shelterId:text('shelter_id').notNull().default('lincoln'),expires:integer('expires').notNull()});
export const limits=sqliteTable('limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expires:integer('expires').notNull()});
