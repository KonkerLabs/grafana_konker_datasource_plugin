import { DataQuery, DataSourceJsonData, SelectableValue } from '@grafana/data';

export interface MyQuery extends DataQuery {
  queryText?: string;
  constant: number;
  application?: SelectableValue<string>;
  location?: SelectableValue<string>;
  device?: SelectableValue<string>;
  channel?: SelectableValue<string>;
  field?: SelectableValue<string>;
}

export const defaultQuery: Partial<MyQuery> = {
  application: { label: 'default', value: 'default' },
  location: { label: 'default', value: 'default' },
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  path?: string;
  apiKey?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
  username?: string;
  password?: string;
}
