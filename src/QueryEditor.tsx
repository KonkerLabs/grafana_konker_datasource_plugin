import React, { PureComponent, KeyboardEvent } from 'react';
import { AsyncSelect, Label, AsyncMultiSelect } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './DataSource';
import { MyDataSourceOptions, MyQuery, defaultQuery } from './types';
import defaults from 'lodash/defaults';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

interface QEState {
  application?: SelectableValue<string>;
  location?: SelectableValue<string>;
  device?: SelectableValue<string>;
  channel?: SelectableValue<string>;
  field?: SelectableValue<string>;
  fieldList?: Array<SelectableValue<string>>;
  channelsFields?: Map<string, Set<string>>;
  deviceFilter?: string;
}

export class QueryEditor extends PureComponent<Props, QEState> {
  constructor(props: Props) {
    super(props);
    console.log('CONSTRUCTOR QUERY EDITOR');
    console.log(props);
    this.state = {
      application: props.query.application
        ? props.query.application
        : { label: '-- select application --', value: undefined },
      location: props.query.location ? props.query.location : { label: '-- select location --', value: undefined },
      device: props.query.device ? props.query.device : { label: '-- select a device --', value: undefined },
      channel: props.query.channel ? props.query.channel : { label: '-- load channels --', value: undefined },
      field: props.query.field ? props.query.field : { label: '-- load fields --', value: undefined },
      fieldList: props.query.fieldList ? props.query.fieldList : [{ label: '-- load fields --', value: undefined }],
    };
  }

  onApplicationKeyDown = (event: KeyboardEvent<Element>) => {
    console.log('application key down ... reload applications from server');
    console.log(event);
    this.loadApplications().then(res => {
      console.log('loaded applications from server');
      console.log(res);
    });
  };

  onApplicationChange = (value: SelectableValue<string>) => {
    const { query, datasource } = this.props;

    console.log('ON APPLICATION CHANGE');

    this.setState({ ...this.state, application: value });
    query.application = value;
    datasource.getLocations(query.application.value).then(locations => {
      console.log(`LOCATIONS for APPLICATION =>${query.application ? query.application.value : 'undefined'}`);
      console.log(locations);

      let defaultLocation = locations.data.result.reduce((t: any, v: any) => {
        if (v.defaultLocation) {
          return v;
        }
        return t;
      });
      query.location = { label: defaultLocation.name, value: defaultLocation.guid };

      this.setState({ ...this.state, location: query.location });
    });

    datasource.getDevices(query.application.value).then(devices => {
      console.log(`DEVICES for APPLICATION =>${query.application ? query.application.value : 'undefined'}`);
      console.log(devices);

      this.setState({ ...this.state, device: { label: '-- select a device --', value: undefined } });
    });
  };

  onLocationChangeSelect = (value: SelectableValue<string>) => {
    const { query } = this.props;
    query.location = value;
    console.log('ON LOCATION CHANGE');
    this.setState({ ...this.state, location: value });
    console.log(`SELECTED LOCATION = ${query.location}`);
    console.log(query.location);
  };

  onDeviceChangeSelect = (value: SelectableValue<string>) => {
    const { query, datasource } = this.props;
    query.device = value;
    console.log('ON DEVICE CHANGE');
    this.setState({ ...this.state, device: value });
    console.log('SELECTED DEVICE');
    console.log(query.device);

    datasource
      .getChannelsAndFieldsForDevice(query.application?.value, query.device?.value)
      .then((res: Map<string, Set<string>>) => {
        console.log('DEVICE CHANNEL AND FIELDS');
        console.log(res);
        // elect first element as default for this selection
        const key = Object.keys(res)[0];
        const _channel: SelectableValue<string> = { label: key, value: key };
        const _fieldName = res
          .get(key)
          ?.values()
          .next().value;
        var _field: SelectableValue<string> = { label: _fieldName, value: _fieldName };

        this.setState({ ...this.state, channelsFields: res, field: _field, channel: _channel });
      });
  };

  onDeviceKeyDown = (event: KeyboardEvent<Element>) => {
    console.log('device key down');
    console.log(event);
  };

  onChannelChange = (value: SelectableValue<string>) => {
    const { query } = this.props;
    query.channel = value;

    console.log('ON CHANNEL CHANGE');
    // clear field
    query.field = undefined;
    query.fieldList = [];
    this.setState({ ...this.state, channel: value, field: undefined, fieldList: [] });
  };

  onFieldChange = (value: SelectableValue<string>) => {
    const { query } = this.props;

    console.log('ON FIELD CHANGE');
    query.field = value;
    this.setState({ ...this.state, field: value });
  };

  onFieldListChange = (value: Array<SelectableValue<string>>) => {
    const { query } = this.props;

    console.log('ON FIELD CHANGE');
    query.fieldList = value;
    this.setState({ ...this.state, fieldList: value });
  };

  onChannelInputChange = (value: string) => {
    console.log('on channel input change');
    console.log(value);
  };

  loadApplications = () => {
    console.log('LOAD APPLICATIONS #1 ...');
    const { datasource } = this.props;
    console.log('LOAD APPLICATIONS #2...');
    console.log(datasource);
    return new Promise<Array<SelectableValue<string>>>(resolve => {
      datasource.getApplications().then(res => {
        console.log('LOADED APPLICATIONS => ');
        console.log(res);
        resolve(
          res.data.result.map((v: any) => {
            return { label: v.friendlyName, value: v.name };
          })
        );
      });
    });
  };

  loadLocations = () => {
    const { query, datasource } = this.props;

    if (!query.application) {
      return new Promise<Array<SelectableValue<string>>>(resolve => {
        [];
      });
    } else {
      return new Promise<Array<SelectableValue<string>>>(resolve => {
        console.log(`GETTING LOCATIONS FOR ${query.application}`);
        datasource.getLocations(query.application ? query.application.value : 'default').then(res => {
          console.log(res);
          resolve(
            res.data.result.map((v: any) => {
              return { label: v.name, value: v.name };
            })
          );
        });
      });
    }
  };

  loadDevices = () => {
    const { query, datasource } = this.props;
    var filter = this.state.deviceFilter;
    if (filter) {
      filter = filter.trim().toUpperCase();
    }
    console.log(`FILTER = ${filter}`);

    return new Promise<Array<SelectableValue<string>>>(resolve => {
      datasource
        .getDevices(
          query.application ? query.application.value : 'default',
          query.location ? query.location.value : 'default'
        )
        .then(res => {
          resolve(
            res.data.result
              .filter((v: any) => {
                return filter ? v.name.toUpperCase().includes(filter) : true;
              })
              .map((v: any) => {
                return { label: v.id, value: v.guid, description: v.name };
              })
          );
        });
    });
  };

  loadChannels = () => {
    var options: Array<SelectableValue<string>> = [];
    console.log('CHANNELS => ');
    console.log(this.state.channelsFields);
    if (this.state.channelsFields) {
      Array.from(this.state.channelsFields.keys()).map(v => {
        options.push({ label: v, value: v });
      });
    }
    console.log('OPTIONS => ');
    console.log(options);
    return new Promise<Array<SelectableValue<string>>>(resolve => {
      resolve(options);
    });
  };

  loadFields = () => {
    var options: Array<SelectableValue<string>> = [];
    console.log(`CHANNEL => ${this.state.channel}`);
    if (this.state.channelsFields && this.state.channel) {
      let channel = this.state.channel.value;
      if (channel) {
        let fields = this.state.channelsFields.get(channel);
        if (fields) {
          Array.from(fields).map(v => {
            options.push({ label: v, value: v });
          });
        }
      }
    }
    return new Promise<Array<SelectableValue<string>>>(resolve => {
      resolve(options);
    });
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    console.log('RENDER QUERY => ');
    console.log(query);
    console.log('STATE =>');
    console.log(this.state);

    return (
      <div className="gf-form">
        <Label>Application</Label>
        <AsyncSelect<string>
          defaultOptions={true}
          loadOptions={this.loadApplications}
          value={this.state.application}
          onChange={this.onApplicationChange}
        />
        <AsyncSelect<string>
          defaultOptions={true}
          loadOptions={this.loadLocations}
          value={this.state.location}
          onChange={this.onLocationChangeSelect}
        />
        <AsyncSelect<string>
          defaultOptions={true}
          loadOptions={this.loadDevices}
          value={this.state.device}
          onChange={this.onDeviceChangeSelect}
        />
        <AsyncSelect<string>
          cacheOptions={false}
          defaultOptions
          loadOptions={this.loadChannels}
          value={this.state.channel}
          onChange={this.onChannelChange}
          onInputChange={this.onChannelInputChange}
        />

        <AsyncSelect<string>
          cacheOptions={false}
          defaultOptions
          loadOptions={this.loadFields}
          value={this.state.field}
          onChange={this.onFieldChange}
        />
        <AsyncMultiSelect<string>
          cacheOptions={false}
          defaultOptions
          loadOptions={this.loadFields}
          value={this.state.fieldList}
          onChange={this.onFieldListChange}
        />
      </div>
    );
  }
}
