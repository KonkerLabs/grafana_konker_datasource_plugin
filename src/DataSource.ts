import defaults from 'lodash/defaults';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

import { MyQuery, MyDataSourceOptions, defaultQuery } from './types';

import axios from 'axios';
const moment = require('moment');

interface FieldData {
  name: string;
  type: FieldType;
}

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  apiToken?: string;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    console.log('KONKER DS PLUGIN CONSTRUCTOR');
    console.log(instanceSettings);

    this.apiToken = instanceSettings.jsonData.apiKey;
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { range } = options;
    const from = range!.from.toISOString();
    const to = range!.to.toISOString();

    console.log('DATASOURCE.QUERY => ');
    console.log('OPTIONS => ');
    console.log(options);

    // Return a constant for each query.
    const data = options.targets.map(target => {
      const query = defaults(target, defaultQuery);
      const { application, device } = target;
      if (application && device) {
        var channel = query.channel!.value;
        var field = query.field!.value;

        return this.getEvents(application.value, device.value, options.maxDataPoints, 'newest', channel, from, to).then(
          (res: any) => {
            // console.log('DATA READ FROM KONKER =>');
            // console.log(res);

            if (res.data.result.length > 0) {
              var fields = Object.keys(res.data.result[0].payload).map(f => {
                let t = typeof res.data.result[0].payload[f];
                let ft: FieldType;
                switch (t) {
                  case 'string': {
                    ft = FieldType.string;
                    break;
                  }
                  case 'number':
                  case 'bigint':
                    ft = FieldType.number;
                    break;
                  case 'boolean':
                    ft = FieldType.boolean;
                    break;
                  default:
                    ft = FieldType.other;
                }
                let x: FieldData = { name: f, type: ft };
                return x;
              });

              // filter fields ... if required
              if (field) {
                // console.log('ALL FIELDS => ');
                // console.log(fields);

                fields = fields.filter(v => {
                  return v.name === field;
                });

                // console.log('FILTERED BY ' + field);
                // console.log(fields);
              }

              const df = new MutableDataFrame({
                refId: query.refId,
                fields: [...fields, { name: 'Time', type: FieldType.time }],
              });
              res.data.result.map((v: any) => {
                // filter payload also
                var payload = v.payload;
                if (field) {
                  // console.log(v.payload);
                  payload = Object.fromEntries(Object.entries(payload).filter(v => v[0] === field));
                  // console.log(payload);
                }
                let d = {
                  Time: moment(v.timestamp).valueOf(),
                  ...payload,
                };
                // console.log(d);
                df.add(d, true);
                return d;
              });
              console.log('DF => ');
              console.log(df);
              df.reverse();
              console.log(df);
              return df;
            }
            return;
          }
        );
      }
      return new MutableDataFrame({
        refId: query.refId,
        fields: [
          { name: 'Time', values: [], type: FieldType.time },
          { name: 'Value', values: [], type: FieldType.number },
        ],
      });
    });

    console.log('DATA =========> ');
    console.log(data);

    return Promise.all(data).then(d => {
      console.log('ALL => ');
      console.log(d);
      return Promise.resolve({ data: d });
    });
  }

  getHeaders(): {} {
    return {
      headers: { Authorization: `Bearer ${this.apiToken}` },
    };
  }

  async getApplications(): Promise<any> {
    let url = 'https://api.prod.konkerlabs.net/v1/applications/?size=500';
    const options = this.getHeaders();
    console.log('HEADERS = ');
    console.log(options);

    return axios.get(url, options);
  }

  async getLocations(application: string | undefined) {
    let url = `https://api.prod.konkerlabs.net/v1/${application}/locations/?size=5000`;
    const options = this.getHeaders();
    return axios.get(url, options);
  }

  async getDevices(application: string | undefined, location?: string, tag?: string, size?: number) {
    let _location = location && location !== 'default' ? `location=${location}` : '';
    let _tag = tag ? `tag=${tag}` : '';
    let _size = size ? `size=${size}` : '';

    let queryString = _size + (_location ? `&${_location}` : '') + (_tag ? `&${_tag}` : '');

    let url = `https://api.prod.konkerlabs.net/v1/${application}/devices/?${queryString}`;
    const options = this.getHeaders();
    return axios.get(url, options);
  }

  async getEvents(
    application: string | undefined,
    guid: string | undefined,
    limit?: number,
    sort?: string,
    channel?: string | undefined,
    from?: string,
    to?: string
  ) {
    // let _limit = limit ? `limit=${limit}` : '';
    let _limit = `limit=10000`;
    let _sort = sort ? `sort=${sort}` : '';
    let _q = `device:${guid}`;
    if (channel) {
      _q = `${_q} channel:${channel}`;
    }
    if (from) {
      _q = `${_q} timestamp:>${from}`;
    }
    if (to) {
      _q = `${_q} timestamp:<${to}`;
    }

    let queryString = `${_limit}&${_sort}&q=${_q}`;

    console.log(`KONKER QUERY STRING = ${queryString}`);

    let url = `https://api.prod.konkerlabs.net/v1/${application}/incomingEvents/?${queryString}`;
    const options = this.getHeaders();
    return axios.get(url, options);
  }

  async getChannelsAndFieldsForDevice(
    application: string | undefined,
    guid: string | undefined
  ): Promise<Map<string, Set<string>>> {
    if (application && guid) {
      return this.getEvents(application, guid, 100, 'newest').then((res: any) => {
        // navigate the data and filter distinct channels and fields for each channel to return
        console.log(`DATA SAMPLE RESULTS FOR DEVICE ${guid}`);
        console.log(res);
        let channelFields = new Map<string, Set<string>>();
        res.data.result.map((v: any) => {
          let channel = v.incoming.channel;
          if (!(channel in channelFields)) {
            channelFields.set(channel, new Set<string>());
          }

          let s = channelFields.get(channel);

          Object.keys(v.payload).forEach((element: string) => {
            s?.add(element);
          });
        });

        return channelFields;
      });
    } else {
      return new Promise(resolve => new Map<string, Set<string>>());
    }
  }

  async testDatasource() {
    // Implement a health check for your data source.
    console.log('TEST DATASOURCE');
    console.log(this);
    console.log('listing applications for this account ... ');
    return this.getApplications().then(apps => {
      console.log(apps);
      return {
        status: 'success',
        message: 'Success',
      };
    });
  }
}
