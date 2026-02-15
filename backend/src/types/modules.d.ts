declare module "marked" {
  export interface MarkedOptions {
    async?: boolean;
    gfm?: boolean;
    breaks?: boolean;
    pedantic?: boolean;
    sanitize?: boolean;
    smartypants?: boolean;
    [key: string]: any;
  }

  export const marked: {
    parse(src: string, options?: MarkedOptions): string;
    setOptions(options: MarkedOptions): void;
  };

  export default marked;
}

declare module "@elastic/elasticsearch" {
  export class Client {
    constructor(config: { node: string; [key: string]: any });
    ping(): Promise<boolean>;
    index(params: any): Promise<any>;
    search(params: any): Promise<any>;
    delete(params: any): Promise<any>;
    update(params: any): Promise<any>;
    bulk(params: any): Promise<any>;
    indices: {
      create(params: any): Promise<any>;
      exists(params: any): Promise<any>;
      delete(params: any): Promise<any>;
      putMapping(params: any): Promise<any>;
    };
  }
}
