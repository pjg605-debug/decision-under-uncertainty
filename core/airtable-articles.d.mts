import type { Article } from './articles';

export type AirtableOptions = {
  token: string;
  baseId: string;
  tableId: string;
  fetchImpl?: typeof fetch;
  publishedOnly?: boolean;
};

export function airtableRecordToArticle(record: { id: string; fields: Record<string, unknown> }): Article | null;
export function articleToAirtableFields(article: Record<string, unknown>, syncState?: string): Record<string, unknown>;
export function fetchAirtableArticleRecords(options: AirtableOptions): Promise<Array<{ id: string; fields: Record<string, unknown> }>>;
export function fetchPublishedArticlesFromAirtable(options: AirtableOptions): Promise<Article[]>;
export function writeAirtableRecords(options: AirtableOptions, records: Array<{ id?: string; fields: Record<string, unknown> }>): Promise<Array<{ id: string; fields: Record<string, unknown> }>>;
export const AIRTABLE_ARTICLE_FIELDS: Record<string, string>;
