/* eslint-disable */

import { AllTypesProps, ReturnTypes, Ops } from './const';
export const HOST = "http://localhost:8080/v1/graphql"


export const HEADERS = {}
export const apiSubscription = (options: chainOptions) => (query: string) => {
  try {
    const queryString = options[0] + '?query=' + encodeURIComponent(query);
    const wsString = queryString.replace('http', 'ws');
    const host = (options.length > 1 && options[1]?.websocket?.[0]) || wsString;
    const webSocketOptions = options[1]?.websocket || [host];
    const ws = new WebSocket(...webSocketOptions);
    return {
      ws,
      on: (e: (args: any) => void) => {
        ws.onmessage = (event: any) => {
          if (event.data) {
            const parsed = JSON.parse(event.data);
            const data = parsed.data;
            return e(data);
          }
        };
      },
      off: (e: (args: any) => void) => {
        ws.onclose = e;
      },
      error: (e: (args: any) => void) => {
        ws.onerror = e;
      },
      open: (e: () => void) => {
        ws.onopen = e;
      },
    };
  } catch {
    throw new Error('No websockets implemented');
  }
};
const handleFetchResponse = (response: Response): Promise<GraphQLResponse> => {
  if (!response.ok) {
    return new Promise((_, reject) => {
      response
        .text()
        .then((text) => {
          try {
            reject(JSON.parse(text));
          } catch (err) {
            reject(text);
          }
        })
        .catch(reject);
    });
  }
  return response.json() as Promise<GraphQLResponse>;
};

export const apiFetch =
  (options: fetchOptions) =>
  (query: string, variables: Record<string, unknown> = {}) => {
    const fetchOptions = options[1] || {};
    if (fetchOptions.method && fetchOptions.method === 'GET') {
      return fetch(`${options[0]}?query=${encodeURIComponent(query)}`, fetchOptions)
        .then(handleFetchResponse)
        .then((response: GraphQLResponse) => {
          if (response.errors) {
            throw new GraphQLError(response);
          }
          return response.data;
        });
    }
    return fetch(`${options[0]}`, {
      body: JSON.stringify({ query, variables }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      ...fetchOptions,
    })
      .then(handleFetchResponse)
      .then((response: GraphQLResponse) => {
        if (response.errors) {
          throw new GraphQLError(response);
        }
        return response.data;
      });
  };

export const InternalsBuildQuery = ({
  ops,
  props,
  returns,
  options,
  scalars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  options?: OperationOptions;
  scalars?: ScalarDefinition;
}) => {
  const ibb = (
    k: string,
    o: InputValueType | VType,
    p = '',
    root = true,
    vars: Array<{ name: string; graphQLType: string }> = [],
  ): string => {
    const keyForPath = purifyGraphQLKey(k);
    const newPath = [p, keyForPath].join(SEPARATOR);
    if (!o) {
      return '';
    }
    if (typeof o === 'boolean' || typeof o === 'number') {
      return k;
    }
    if (typeof o === 'string') {
      return `${k} ${o}`;
    }
    if (Array.isArray(o)) {
      const args = InternalArgsBuilt({
        props,
        returns,
        ops,
        scalars,
        vars,
      })(o[0], newPath);
      return `${ibb(args ? `${k}(${args})` : k, o[1], p, false, vars)}`;
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(`${alias}:${operationName}`, operation, p, false, vars);
        })
        .join('\n');
    }
    const hasOperationName = root && options?.operationName ? ' ' + options.operationName : '';
    const keyForDirectives = o.__directives ?? '';
    const query = `{${Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map((e) => ibb(...e, [p, `field<>${keyForPath}`].join(SEPARATOR), false, vars))
      .join('\n')}}`;
    if (!root) {
      return `${k} ${keyForDirectives}${hasOperationName} ${query}`;
    }
    const varsString = vars.map((v) => `${v.name}: ${v.graphQLType}`).join(', ');
    return `${k} ${keyForDirectives}${hasOperationName}${varsString ? `(${varsString})` : ''} ${query}`;
  };
  return ibb;
};

export const Thunder =
  (fn: FetchFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(
    o: (Z & ValueTypes[R]) | ValueTypes[R],
    ops?: OperationOptions & { variables?: Record<string, unknown> },
  ) =>
    fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
      ops?.variables,
    ).then((data) => {
      if (graphqlOptions?.scalars) {
        return decodeScalarsInResponse({
          response: data,
          initialOp: operation,
          initialZeusQuery: o as VType,
          returns: ReturnTypes,
          scalars: graphqlOptions.scalars,
          ops: Ops,
        });
      }
      return data;
    }) as Promise<InputType<GraphQLTypes[R], Z, SCLR>>;

export const Chain = (...options: chainOptions) => Thunder(apiFetch(options));

export const SubscriptionThunder =
  (fn: SubscriptionFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(
    o: (Z & ValueTypes[R]) | ValueTypes[R],
    ops?: OperationOptions & { variables?: ExtractVariables<Z> },
  ) => {
    const returnedFunction = fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
    ) as SubscriptionToGraphQL<Z, GraphQLTypes[R], SCLR>;
    if (returnedFunction?.on && graphqlOptions?.scalars) {
      const wrapped = returnedFunction.on;
      returnedFunction.on = (fnToCall: (args: InputType<GraphQLTypes[R], Z, SCLR>) => void) =>
        wrapped((data: InputType<GraphQLTypes[R], Z, SCLR>) => {
          if (graphqlOptions?.scalars) {
            return fnToCall(
              decodeScalarsInResponse({
                response: data,
                initialOp: operation,
                initialZeusQuery: o as VType,
                returns: ReturnTypes,
                scalars: graphqlOptions.scalars,
                ops: Ops,
              }),
            );
          }
          return fnToCall(data);
        });
    }
    return returnedFunction;
  };

export const Subscription = (...options: chainOptions) => SubscriptionThunder(apiSubscription(options));
export const Zeus = <
  Z extends ValueTypes[R],
  O extends keyof typeof Ops,
  R extends keyof ValueTypes = GenericOperation<O>,
>(
  operation: O,
  o: (Z & ValueTypes[R]) | ValueTypes[R],
  ops?: {
    operationOptions?: OperationOptions;
    scalars?: ScalarDefinition;
  },
) =>
  InternalsBuildQuery({
    props: AllTypesProps,
    returns: ReturnTypes,
    ops: Ops,
    options: ops?.operationOptions,
    scalars: ops?.scalars,
  })(operation, o as VType);

export const ZeusSelect = <T>() => ((t: unknown) => t) as SelectionFunction<T>;

export const Selector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();

export const TypeFromSelector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();
export const Gql = Chain(HOST, {
  headers: {
    'Content-Type': 'application/json',
    ...HEADERS,
  },
});

export const ZeusScalars = ZeusSelect<ScalarCoders>();

export const decodeScalarsInResponse = <O extends Operations>({
  response,
  scalars,
  returns,
  ops,
  initialZeusQuery,
  initialOp,
}: {
  ops: O;
  response: any;
  returns: ReturnTypesType;
  scalars?: Record<string, ScalarResolver | undefined>;
  initialOp: keyof O;
  initialZeusQuery: InputValueType | VType;
}) => {
  if (!scalars) {
    return response;
  }
  const builder = PrepareScalarPaths({
    ops,
    returns,
  });

  const scalarPaths = builder(initialOp as string, ops[initialOp], initialZeusQuery);
  if (scalarPaths) {
    const r = traverseResponse({ scalarPaths, resolvers: scalars })(initialOp as string, response, [ops[initialOp]]);
    return r;
  }
  return response;
};

export const traverseResponse = ({
  resolvers,
  scalarPaths,
}: {
  scalarPaths: { [x: string]: `scalar.${string}` };
  resolvers: {
    [x: string]: ScalarResolver | undefined;
  };
}) => {
  const ibb = (k: string, o: InputValueType | VType, p: string[] = []): unknown => {
    if (Array.isArray(o)) {
      return o.map((eachO) => ibb(k, eachO, p));
    }
    if (o == null) {
      return o;
    }
    const scalarPathString = p.join(SEPARATOR);
    const currentScalarString = scalarPaths[scalarPathString];
    if (currentScalarString) {
      const currentDecoder = resolvers[currentScalarString.split('.')[1]]?.decode;
      if (currentDecoder) {
        return currentDecoder(o);
      }
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string' || !o) {
      return o;
    }
    const entries = Object.entries(o).map(([k, v]) => [k, ibb(k, v, [...p, purifyGraphQLKey(k)])] as const);
    const objectFromEntries = entries.reduce<Record<string, unknown>>((a, [k, v]) => {
      a[k] = v;
      return a;
    }, {});
    return objectFromEntries;
  };
  return ibb;
};

export type AllTypesPropsType = {
  [x: string]:
    | undefined
    | `scalar.${string}`
    | 'enum'
    | {
        [x: string]:
          | undefined
          | string
          | {
              [x: string]: string | undefined;
            };
      };
};

export type ReturnTypesType = {
  [x: string]:
    | {
        [x: string]: string | undefined;
      }
    | `scalar.${string}`
    | undefined;
};
export type InputValueType = {
  [x: string]: undefined | boolean | string | number | [any, undefined | boolean | InputValueType] | InputValueType;
};
export type VType =
  | undefined
  | boolean
  | string
  | number
  | [any, undefined | boolean | InputValueType]
  | InputValueType;

export type PlainType = boolean | number | string | null | undefined;
export type ZeusArgsType =
  | PlainType
  | {
      [x: string]: ZeusArgsType;
    }
  | Array<ZeusArgsType>;

export type Operations = Record<string, string>;

export type VariableDefinition = {
  [x: string]: unknown;
};

export const SEPARATOR = '|';

export type fetchOptions = Parameters<typeof fetch>;
type websocketOptions = typeof WebSocket extends new (...args: infer R) => WebSocket ? R : never;
export type chainOptions = [fetchOptions[0], fetchOptions[1] & { websocket?: websocketOptions }] | [fetchOptions[0]];
export type FetchFunction = (query: string, variables?: Record<string, unknown>) => Promise<any>;
export type SubscriptionFunction = (query: string) => any;
type NotUndefined<T> = T extends undefined ? never : T;
export type ResolverType<F> = NotUndefined<F extends [infer ARGS, any] ? ARGS : undefined>;

export type OperationOptions = {
  operationName?: string;
};

export type ScalarCoder = Record<string, (s: unknown) => string>;

export interface GraphQLResponse {
  data?: Record<string, any>;
  errors?: Array<{
    message: string;
  }>;
}
export class GraphQLError extends Error {
  constructor(public response: GraphQLResponse) {
    super('');
    console.error(response);
  }
  toString() {
    return 'GraphQL Response Error';
  }
}
export type GenericOperation<O> = O extends keyof typeof Ops ? typeof Ops[O] : never;
export type ThunderGraphQLOptions<SCLR extends ScalarDefinition> = {
  scalars?: SCLR | ScalarCoders;
};

const ExtractScalar = (mappedParts: string[], returns: ReturnTypesType): `scalar.${string}` | undefined => {
  if (mappedParts.length === 0) {
    return;
  }
  const oKey = mappedParts[0];
  const returnP1 = returns[oKey];
  if (typeof returnP1 === 'object') {
    const returnP2 = returnP1[mappedParts[1]];
    if (returnP2) {
      return ExtractScalar([returnP2, ...mappedParts.slice(2)], returns);
    }
    return undefined;
  }
  return returnP1 as `scalar.${string}` | undefined;
};

export const PrepareScalarPaths = ({ ops, returns }: { returns: ReturnTypesType; ops: Operations }) => {
  const ibb = (
    k: string,
    originalKey: string,
    o: InputValueType | VType,
    p: string[] = [],
    pOriginals: string[] = [],
    root = true,
  ): { [x: string]: `scalar.${string}` } | undefined => {
    if (!o) {
      return;
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string') {
      const extractionArray = [...pOriginals, originalKey];
      const isScalar = ExtractScalar(extractionArray, returns);
      if (isScalar?.startsWith('scalar')) {
        const partOfTree = {
          [[...p, k].join(SEPARATOR)]: isScalar,
        };
        return partOfTree;
      }
      return {};
    }
    if (Array.isArray(o)) {
      return ibb(k, k, o[1], p, pOriginals, false);
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(alias, operationName, operation, p, pOriginals, false);
        })
        .reduce((a, b) => ({
          ...a,
          ...b,
        }));
    }
    const keyName = root ? ops[k] : k;
    return Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map(([k, v]) => {
        // Inline fragments shouldn't be added to the path as they aren't a field
        const isInlineFragment = originalKey.match(/^...\s*on/) != null;
        return ibb(
          k,
          k,
          v,
          isInlineFragment ? p : [...p, purifyGraphQLKey(keyName || k)],
          isInlineFragment ? pOriginals : [...pOriginals, purifyGraphQLKey(originalKey)],
          false,
        );
      })
      .reduce((a, b) => ({
        ...a,
        ...b,
      }));
  };
  return ibb;
};

export const purifyGraphQLKey = (k: string) => k.replace(/\([^)]*\)/g, '').replace(/^[^:]*\:/g, '');

const mapPart = (p: string) => {
  const [isArg, isField] = p.split('<>');
  if (isField) {
    return {
      v: isField,
      __type: 'field',
    } as const;
  }
  return {
    v: isArg,
    __type: 'arg',
  } as const;
};

type Part = ReturnType<typeof mapPart>;

export const ResolveFromPath = (props: AllTypesPropsType, returns: ReturnTypesType, ops: Operations) => {
  const ResolvePropsType = (mappedParts: Part[]) => {
    const oKey = ops[mappedParts[0].v];
    const propsP1 = oKey ? props[oKey] : props[mappedParts[0].v];
    if (propsP1 === 'enum' && mappedParts.length === 1) {
      return 'enum';
    }
    if (typeof propsP1 === 'string' && propsP1.startsWith('scalar.') && mappedParts.length === 1) {
      return propsP1;
    }
    if (typeof propsP1 === 'object') {
      if (mappedParts.length < 2) {
        return 'not';
      }
      const propsP2 = propsP1[mappedParts[1].v];
      if (typeof propsP2 === 'string') {
        return rpp(
          `${propsP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
      if (typeof propsP2 === 'object') {
        if (mappedParts.length < 3) {
          return 'not';
        }
        const propsP3 = propsP2[mappedParts[2].v];
        if (propsP3 && mappedParts[2].__type === 'arg') {
          return rpp(
            `${propsP3}${SEPARATOR}${mappedParts
              .slice(3)
              .map((mp) => mp.v)
              .join(SEPARATOR)}`,
          );
        }
      }
    }
  };
  const ResolveReturnType = (mappedParts: Part[]) => {
    if (mappedParts.length === 0) {
      return 'not';
    }
    const oKey = ops[mappedParts[0].v];
    const returnP1 = oKey ? returns[oKey] : returns[mappedParts[0].v];
    if (typeof returnP1 === 'object') {
      if (mappedParts.length < 2) return 'not';
      const returnP2 = returnP1[mappedParts[1].v];
      if (returnP2) {
        return rpp(
          `${returnP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
    }
  };
  const rpp = (path: string): 'enum' | 'not' | `scalar.${string}` => {
    const parts = path.split(SEPARATOR).filter((l) => l.length > 0);
    const mappedParts = parts.map(mapPart);
    const propsP1 = ResolvePropsType(mappedParts);
    if (propsP1) {
      return propsP1;
    }
    const returnP1 = ResolveReturnType(mappedParts);
    if (returnP1) {
      return returnP1;
    }
    return 'not';
  };
  return rpp;
};

export const InternalArgsBuilt = ({
  props,
  ops,
  returns,
  scalars,
  vars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  scalars?: ScalarDefinition;
  vars: Array<{ name: string; graphQLType: string }>;
}) => {
  const arb = (a: ZeusArgsType, p = '', root = true): string => {
    if (typeof a === 'string') {
      if (a.startsWith(START_VAR_NAME)) {
        const [varName, graphQLType] = a.replace(START_VAR_NAME, '$').split(GRAPHQL_TYPE_SEPARATOR);
        const v = vars.find((v) => v.name === varName);
        if (!v) {
          vars.push({
            name: varName,
            graphQLType,
          });
        } else {
          if (v.graphQLType !== graphQLType) {
            throw new Error(
              `Invalid variable exists with two different GraphQL Types, "${v.graphQLType}" and ${graphQLType}`,
            );
          }
        }
        return varName;
      }
    }
    const checkType = ResolveFromPath(props, returns, ops)(p);
    if (checkType.startsWith('scalar.')) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, ...splittedScalar] = checkType.split('.');
      const scalarKey = splittedScalar.join('.');
      return (scalars?.[scalarKey]?.encode?.(a) as string) || JSON.stringify(a);
    }
    if (Array.isArray(a)) {
      return `[${a.map((arr) => arb(arr, p, false)).join(', ')}]`;
    }
    if (typeof a === 'string') {
      if (checkType === 'enum') {
        return a;
      }
      return `${JSON.stringify(a)}`;
    }
    if (typeof a === 'object') {
      if (a === null) {
        return `null`;
      }
      const returnedObjectString = Object.entries(a)
        .filter(([, v]) => typeof v !== 'undefined')
        .map(([k, v]) => `${k}: ${arb(v, [p, k].join(SEPARATOR), false)}`)
        .join(',\n');
      if (!root) {
        return `{${returnedObjectString}}`;
      }
      return returnedObjectString;
    }
    return `${a}`;
  };
  return arb;
};

export const resolverFor = <X, T extends keyof ResolverInputTypes, Z extends keyof ResolverInputTypes[T]>(
  type: T,
  field: Z,
  fn: (
    args: Required<ResolverInputTypes[T]>[Z] extends [infer Input, any] ? Input : any,
    source: any,
  ) => Z extends keyof ModelTypes[T] ? ModelTypes[T][Z] | Promise<ModelTypes[T][Z]> | X : never,
) => fn as (args?: any, source?: any) => ReturnType<typeof fn>;

export type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;
export type ZeusState<T extends (...args: any[]) => Promise<any>> = NonNullable<UnwrapPromise<ReturnType<T>>>;
export type ZeusHook<
  T extends (...args: any[]) => Record<string, (...args: any[]) => Promise<any>>,
  N extends keyof ReturnType<T>,
> = ZeusState<ReturnType<T>[N]>;

export type WithTypeNameValue<T> = T & {
  __typename?: boolean;
  __directives?: string;
};
export type AliasType<T> = WithTypeNameValue<T> & {
  __alias?: Record<string, WithTypeNameValue<T>>;
};
type DeepAnify<T> = {
  [P in keyof T]?: any;
};
type IsPayLoad<T> = T extends [any, infer PayLoad] ? PayLoad : T;
export type ScalarDefinition = Record<string, ScalarResolver>;

type IsScalar<S, SCLR extends ScalarDefinition> = S extends 'scalar' & { name: infer T }
  ? T extends keyof SCLR
    ? SCLR[T]['decode'] extends (s: unknown) => unknown
      ? ReturnType<SCLR[T]['decode']>
      : unknown
    : unknown
  : S;
type IsArray<T, U, SCLR extends ScalarDefinition> = T extends Array<infer R>
  ? InputType<R, U, SCLR>[]
  : InputType<T, U, SCLR>;
type FlattenArray<T> = T extends Array<infer R> ? R : T;
type BaseZeusResolver = boolean | 1 | string | Variable<any, string>;

type IsInterfaced<SRC extends DeepAnify<DST>, DST, SCLR extends ScalarDefinition> = FlattenArray<SRC> extends
  | ZEUS_INTERFACES
  | ZEUS_UNIONS
  ? {
      [P in keyof SRC]: SRC[P] extends '__union' & infer R
        ? P extends keyof DST
          ? IsArray<R, '__typename' extends keyof DST ? DST[P] & { __typename: true } : DST[P], SCLR>
          : IsArray<R, '__typename' extends keyof DST ? { __typename: true } : Record<string, never>, SCLR>
        : never;
    }[keyof SRC] & {
      [P in keyof Omit<
        Pick<
          SRC,
          {
            [P in keyof DST]: SRC[P] extends '__union' & infer R ? never : P;
          }[keyof DST]
        >,
        '__typename'
      >]: IsPayLoad<DST[P]> extends BaseZeusResolver ? IsScalar<SRC[P], SCLR> : IsArray<SRC[P], DST[P], SCLR>;
    }
  : {
      [P in keyof Pick<SRC, keyof DST>]: IsPayLoad<DST[P]> extends BaseZeusResolver
        ? IsScalar<SRC[P], SCLR>
        : IsArray<SRC[P], DST[P], SCLR>;
    };

export type MapType<SRC, DST, SCLR extends ScalarDefinition> = SRC extends DeepAnify<DST>
  ? IsInterfaced<SRC, DST, SCLR>
  : never;
// eslint-disable-next-line @typescript-eslint/ban-types
export type InputType<SRC, DST, SCLR extends ScalarDefinition = {}> = IsPayLoad<DST> extends { __alias: infer R }
  ? {
      [P in keyof R]: MapType<SRC, R[P], SCLR>[keyof MapType<SRC, R[P], SCLR>];
    } & MapType<SRC, Omit<IsPayLoad<DST>, '__alias'>, SCLR>
  : MapType<SRC, IsPayLoad<DST>, SCLR>;
export type SubscriptionToGraphQL<Z, T, SCLR extends ScalarDefinition> = {
  ws: WebSocket;
  on: (fn: (args: InputType<T, Z, SCLR>) => void) => void;
  off: (fn: (e: { data?: InputType<T, Z, SCLR>; code?: number; reason?: string; message?: string }) => void) => void;
  error: (fn: (e: { data?: InputType<T, Z, SCLR>; errors?: string[] }) => void) => void;
  open: () => void;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type FromSelector<SELECTOR, NAME extends keyof GraphQLTypes, SCLR extends ScalarDefinition = {}> = InputType<
  GraphQLTypes[NAME],
  SELECTOR,
  SCLR
>;

export type ScalarResolver = {
  encode?: (s: unknown) => string;
  decode?: (s: unknown) => unknown;
};

export type SelectionFunction<V> = <T>(t: T | V) => T;

type BuiltInVariableTypes = {
  ['String']: string;
  ['Int']: number;
  ['Float']: number;
  ['ID']: unknown;
  ['Boolean']: boolean;
};
type AllVariableTypes = keyof BuiltInVariableTypes | keyof ZEUS_VARIABLES;
type VariableRequired<T extends string> = `${T}!` | T | `[${T}]` | `[${T}]!` | `[${T}!]` | `[${T}!]!`;
type VR<T extends string> = VariableRequired<VariableRequired<T>>;

export type GraphQLVariableType = VR<AllVariableTypes>;

type ExtractVariableTypeString<T extends string> = T extends VR<infer R1>
  ? R1 extends VR<infer R2>
    ? R2 extends VR<infer R3>
      ? R3 extends VR<infer R4>
        ? R4 extends VR<infer R5>
          ? R5
          : R4
        : R3
      : R2
    : R1
  : T;

type DecomposeType<T, Type> = T extends `[${infer R}]`
  ? Array<DecomposeType<R, Type>> | undefined
  : T extends `${infer R}!`
  ? NonNullable<DecomposeType<R, Type>>
  : Type | undefined;

type ExtractTypeFromGraphQLType<T extends string> = T extends keyof ZEUS_VARIABLES
  ? ZEUS_VARIABLES[T]
  : T extends keyof BuiltInVariableTypes
  ? BuiltInVariableTypes[T]
  : any;

export type GetVariableType<T extends string> = DecomposeType<
  T,
  ExtractTypeFromGraphQLType<ExtractVariableTypeString<T>>
>;

type UndefinedKeys<T> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? never : K;
}[keyof T];

type WithNullableKeys<T> = Pick<T, UndefinedKeys<T>>;
type WithNonNullableKeys<T> = Omit<T, UndefinedKeys<T>>;

type OptionalKeys<T> = {
  [P in keyof T]?: T[P];
};

export type WithOptionalNullables<T> = OptionalKeys<WithNullableKeys<T>> & WithNonNullableKeys<T>;

export type Variable<T extends GraphQLVariableType, Name extends string> = {
  ' __zeus_name': Name;
  ' __zeus_type': T;
};

export type ExtractVariablesDeep<Query> = Query extends Variable<infer VType, infer VName>
  ? { [key in VName]: GetVariableType<VType> }
  : Query extends string | number | boolean | Array<string | number | boolean>
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : UnionToIntersection<{ [K in keyof Query]: WithOptionalNullables<ExtractVariablesDeep<Query[K]>> }[keyof Query]>;

export type ExtractVariables<Query> = Query extends Variable<infer VType, infer VName>
  ? { [key in VName]: GetVariableType<VType> }
  : Query extends [infer Inputs, infer Outputs]
  ? ExtractVariablesDeep<Inputs> & ExtractVariables<Outputs>
  : Query extends string | number | boolean | Array<string | number | boolean>
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : UnionToIntersection<{ [K in keyof Query]: WithOptionalNullables<ExtractVariables<Query[K]>> }[keyof Query]>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export const START_VAR_NAME = `$ZEUS_VAR`;
export const GRAPHQL_TYPE_SEPARATOR = `__$GRAPHQL__`;

export const $ = <Type extends GraphQLVariableType, Name extends string>(name: Name, graphqlType: Type) => {
  return (START_VAR_NAME + name + GRAPHQL_TYPE_SEPARATOR + graphqlType) as unknown as Variable<Type, Name>;
};
type ZEUS_INTERFACES = never
export type ScalarCoders = {
	bigint?: ScalarResolver;
	date?: ScalarResolver;
	timestamptz?: ScalarResolver;
	uuid?: ScalarResolver;
}
type ZEUS_UNIONS = never

export type ValueTypes = {
    /** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
["Int_comparison_exp"]: {
	_eq?: number | undefined | null | Variable<any, string>,
	_gt?: number | undefined | null | Variable<any, string>,
	_gte?: number | undefined | null | Variable<any, string>,
	_in?: Array<number> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: number | undefined | null | Variable<any, string>,
	_lte?: number | undefined | null | Variable<any, string>,
	_neq?: number | undefined | null | Variable<any, string>,
	_nin?: Array<number> | undefined | null | Variable<any, string>
};
	/** columns and relationships of "STATUS" */
["STATUS"]: AliasType<{
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "STATUS" */
["STATUS_aggregate"]: AliasType<{
	aggregate?:ValueTypes["STATUS_aggregate_fields"],
	nodes?:ValueTypes["STATUS"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "STATUS" */
["STATUS_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["STATUS_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["STATUS_max_fields"],
	min?:ValueTypes["STATUS_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "STATUS". All fields are combined with a logical 'AND'. */
["STATUS_bool_exp"]: {
	_and?: Array<ValueTypes["STATUS_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["STATUS_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["STATUS_bool_exp"]> | undefined | null | Variable<any, string>,
	value?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "STATUS" */
["STATUS_constraint"]:STATUS_constraint;
	["STATUS_enum"]:STATUS_enum;
	/** Boolean expression to compare columns of type "STATUS_enum". All fields are combined with logical 'AND'. */
["STATUS_enum_comparison_exp"]: {
	_eq?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["STATUS_enum"]> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["STATUS_enum"]> | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "STATUS" */
["STATUS_insert_input"]: {
	value?: string | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["STATUS_max_fields"]: AliasType<{
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["STATUS_min_fields"]: AliasType<{
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "STATUS" */
["STATUS_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["STATUS"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "STATUS" */
["STATUS_on_conflict"]: {
	constraint: ValueTypes["STATUS_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["STATUS_update_column"]> | Variable<any, string>,
	where?: ValueTypes["STATUS_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "STATUS". */
["STATUS_order_by"]: {
	value?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: STATUS */
["STATUS_pk_columns_input"]: {
	value: string | Variable<any, string>
};
	/** select columns of table "STATUS" */
["STATUS_select_column"]:STATUS_select_column;
	/** input type for updating data in table "STATUS" */
["STATUS_set_input"]: {
	value?: string | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "STATUS" */
["STATUS_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["STATUS_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["STATUS_stream_cursor_value_input"]: {
	value?: string | undefined | null | Variable<any, string>
};
	/** update columns of table "STATUS" */
["STATUS_update_column"]:STATUS_update_column;
	["STATUS_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["STATUS_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["STATUS_bool_exp"] | Variable<any, string>
};
	/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
["String_comparison_exp"]: {
	_eq?: string | undefined | null | Variable<any, string>,
	_gt?: string | undefined | null | Variable<any, string>,
	_gte?: string | undefined | null | Variable<any, string>,
	/** does the column match the given case-insensitive pattern */
	_ilike?: string | undefined | null | Variable<any, string>,
	_in?: Array<string> | undefined | null | Variable<any, string>,
	/** does the column match the given POSIX regular expression, case insensitive */
	_iregex?: string | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	/** does the column match the given pattern */
	_like?: string | undefined | null | Variable<any, string>,
	_lt?: string | undefined | null | Variable<any, string>,
	_lte?: string | undefined | null | Variable<any, string>,
	_neq?: string | undefined | null | Variable<any, string>,
	/** does the column NOT match the given case-insensitive pattern */
	_nilike?: string | undefined | null | Variable<any, string>,
	_nin?: Array<string> | undefined | null | Variable<any, string>,
	/** does the column NOT match the given POSIX regular expression, case insensitive */
	_niregex?: string | undefined | null | Variable<any, string>,
	/** does the column NOT match the given pattern */
	_nlike?: string | undefined | null | Variable<any, string>,
	/** does the column NOT match the given POSIX regular expression, case sensitive */
	_nregex?: string | undefined | null | Variable<any, string>,
	/** does the column NOT match the given SQL regular expression */
	_nsimilar?: string | undefined | null | Variable<any, string>,
	/** does the column match the given POSIX regular expression, case sensitive */
	_regex?: string | undefined | null | Variable<any, string>,
	/** does the column match the given SQL regular expression */
	_similar?: string | undefined | null | Variable<any, string>
};
	["bigint"]:unknown;
	/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
["bigint_comparison_exp"]: {
	_eq?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	_gt?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	_gte?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["bigint"]> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	_lte?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["bigint"]> | undefined | null | Variable<any, string>
};
	/** ordering argument of a cursor */
["cursor_ordering"]:cursor_ordering;
	["date"]:unknown;
	/** Boolean expression to compare columns of type "date". All fields are combined with logical 'AND'. */
["date_comparison_exp"]: {
	_eq?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	_gt?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	_gte?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["date"]> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	_lte?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["date"]> | undefined | null | Variable<any, string>
};
	/** columns and relationships of "e_governance" */
["e_governance"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	/** An object relationship */
	institute?:ValueTypes["institute"],
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone_no?:boolean | `@${string}`,
	service_end_date?:boolean | `@${string}`,
	service_start_date?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	total_amount?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "e_governance" */
["e_governance_aggregate"]: AliasType<{
	aggregate?:ValueTypes["e_governance_aggregate_fields"],
	nodes?:ValueTypes["e_governance"],
		__typename?: boolean | `@${string}`
}>;
	["e_governance_aggregate_bool_exp"]: {
	count?: ValueTypes["e_governance_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["e_governance_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["e_governance_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["e_governance_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "e_governance" */
["e_governance_aggregate_fields"]: AliasType<{
	avg?:ValueTypes["e_governance_avg_fields"],
count?: [{	columns?: Array<ValueTypes["e_governance_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["e_governance_max_fields"],
	min?:ValueTypes["e_governance_min_fields"],
	stddev?:ValueTypes["e_governance_stddev_fields"],
	stddev_pop?:ValueTypes["e_governance_stddev_pop_fields"],
	stddev_samp?:ValueTypes["e_governance_stddev_samp_fields"],
	sum?:ValueTypes["e_governance_sum_fields"],
	var_pop?:ValueTypes["e_governance_var_pop_fields"],
	var_samp?:ValueTypes["e_governance_var_samp_fields"],
	variance?:ValueTypes["e_governance_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "e_governance" */
["e_governance_aggregate_order_by"]: {
	avg?: ValueTypes["e_governance_avg_order_by"] | undefined | null | Variable<any, string>,
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["e_governance_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["e_governance_min_order_by"] | undefined | null | Variable<any, string>,
	stddev?: ValueTypes["e_governance_stddev_order_by"] | undefined | null | Variable<any, string>,
	stddev_pop?: ValueTypes["e_governance_stddev_pop_order_by"] | undefined | null | Variable<any, string>,
	stddev_samp?: ValueTypes["e_governance_stddev_samp_order_by"] | undefined | null | Variable<any, string>,
	sum?: ValueTypes["e_governance_sum_order_by"] | undefined | null | Variable<any, string>,
	var_pop?: ValueTypes["e_governance_var_pop_order_by"] | undefined | null | Variable<any, string>,
	var_samp?: ValueTypes["e_governance_var_samp_order_by"] | undefined | null | Variable<any, string>,
	variance?: ValueTypes["e_governance_variance_order_by"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "e_governance" */
["e_governance_arr_rel_insert_input"]: {
	data: Array<ValueTypes["e_governance_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["e_governance_on_conflict"] | undefined | null | Variable<any, string>
};
	/** aggregate avg on columns */
["e_governance_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "e_governance" */
["e_governance_avg_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "e_governance". All fields are combined with a logical 'AND'. */
["e_governance_bool_exp"]: {
	_and?: Array<ValueTypes["e_governance_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["e_governance_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["e_governance_bool_exp"]> | undefined | null | Variable<any, string>,
	address?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	area?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_bool_exp"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	phone_no?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	service_end_date?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	service_start_date?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	total_amount?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	website?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "e_governance" */
["e_governance_constraint"]:e_governance_constraint;
	/** input type for incrementing numeric columns in table "e_governance" */
["e_governance_inc_input"]: {
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "e_governance" */
["e_governance_insert_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	area?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phone_no?: string | undefined | null | Variable<any, string>,
	service_end_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	service_start_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	total_amount?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["e_governance_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone_no?:boolean | `@${string}`,
	service_end_date?:boolean | `@${string}`,
	service_start_date?:boolean | `@${string}`,
	total_amount?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "e_governance" */
["e_governance_max_order_by"]: {
	address?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	area?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phone_no?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	service_end_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	service_start_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	total_amount?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	website?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["e_governance_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone_no?:boolean | `@${string}`,
	service_end_date?:boolean | `@${string}`,
	service_start_date?:boolean | `@${string}`,
	total_amount?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "e_governance" */
["e_governance_min_order_by"]: {
	address?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	area?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phone_no?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	service_end_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	service_start_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	total_amount?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	website?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "e_governance" */
["e_governance_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["e_governance"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "e_governance" */
["e_governance_on_conflict"]: {
	constraint: ValueTypes["e_governance_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["e_governance_update_column"]> | Variable<any, string>,
	where?: ValueTypes["e_governance_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "e_governance". */
["e_governance_order_by"]: {
	address?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	area?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phone_no?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	service_end_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	service_start_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	total_amount?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	website?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: e_governance */
["e_governance_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "e_governance" */
["e_governance_select_column"]:e_governance_select_column;
	/** input type for updating data in table "e_governance" */
["e_governance_set_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	area?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phone_no?: string | undefined | null | Variable<any, string>,
	service_end_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	service_start_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	total_amount?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["e_governance_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "e_governance" */
["e_governance_stddev_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_pop on columns */
["e_governance_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "e_governance" */
["e_governance_stddev_pop_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_samp on columns */
["e_governance_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "e_governance" */
["e_governance_stddev_samp_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "e_governance" */
["e_governance_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["e_governance_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["e_governance_stream_cursor_value_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	area?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phone_no?: string | undefined | null | Variable<any, string>,
	service_end_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	service_start_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	total_amount?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["e_governance_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "e_governance" */
["e_governance_sum_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** update columns of table "e_governance" */
["e_governance_update_column"]:e_governance_update_column;
	["e_governance_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["e_governance_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["e_governance_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["e_governance_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["e_governance_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "e_governance" */
["e_governance_var_pop_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate var_samp on columns */
["e_governance_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "e_governance" */
["e_governance_var_samp_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate variance on columns */
["e_governance_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "e_governance" */
["e_governance_variance_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** columns and relationships of "faculty" */
["faculty"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_of_joining?:boolean | `@${string}`,
	designation?:boolean | `@${string}`,
	dob?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	experience?:boolean | `@${string}`,
faculty_fundings?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty_funding"]],
faculty_fundings_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty_funding_aggregate"]],
fdp_pdps?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["fdp_pdp_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["fdp_pdp_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["fdp_pdp"]],
fdp_pdps_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["fdp_pdp_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["fdp_pdp_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["fdp_pdp_aggregate"]],
	gender?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	/** An object relationship */
	institute?:ValueTypes["institute"],
	institute_id?:boolean | `@${string}`,
	job_type?:boolean | `@${string}`,
	minority?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pan_card_no?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	qualification?:boolean | `@${string}`,
	section?:boolean | `@${string}`,
	staff_type?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	status_of_approval?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "faculty" */
["faculty_aggregate"]: AliasType<{
	aggregate?:ValueTypes["faculty_aggregate_fields"],
	nodes?:ValueTypes["faculty"],
		__typename?: boolean | `@${string}`
}>;
	["faculty_aggregate_bool_exp"]: {
	count?: ValueTypes["faculty_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["faculty_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["faculty_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["faculty_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "faculty" */
["faculty_aggregate_fields"]: AliasType<{
	avg?:ValueTypes["faculty_avg_fields"],
count?: [{	columns?: Array<ValueTypes["faculty_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["faculty_max_fields"],
	min?:ValueTypes["faculty_min_fields"],
	stddev?:ValueTypes["faculty_stddev_fields"],
	stddev_pop?:ValueTypes["faculty_stddev_pop_fields"],
	stddev_samp?:ValueTypes["faculty_stddev_samp_fields"],
	sum?:ValueTypes["faculty_sum_fields"],
	var_pop?:ValueTypes["faculty_var_pop_fields"],
	var_samp?:ValueTypes["faculty_var_samp_fields"],
	variance?:ValueTypes["faculty_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "faculty" */
["faculty_aggregate_order_by"]: {
	avg?: ValueTypes["faculty_avg_order_by"] | undefined | null | Variable<any, string>,
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["faculty_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["faculty_min_order_by"] | undefined | null | Variable<any, string>,
	stddev?: ValueTypes["faculty_stddev_order_by"] | undefined | null | Variable<any, string>,
	stddev_pop?: ValueTypes["faculty_stddev_pop_order_by"] | undefined | null | Variable<any, string>,
	stddev_samp?: ValueTypes["faculty_stddev_samp_order_by"] | undefined | null | Variable<any, string>,
	sum?: ValueTypes["faculty_sum_order_by"] | undefined | null | Variable<any, string>,
	var_pop?: ValueTypes["faculty_var_pop_order_by"] | undefined | null | Variable<any, string>,
	var_samp?: ValueTypes["faculty_var_samp_order_by"] | undefined | null | Variable<any, string>,
	variance?: ValueTypes["faculty_variance_order_by"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "faculty" */
["faculty_arr_rel_insert_input"]: {
	data: Array<ValueTypes["faculty_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["faculty_on_conflict"] | undefined | null | Variable<any, string>
};
	/** aggregate avg on columns */
["faculty_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "faculty" */
["faculty_avg_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "faculty". All fields are combined with a logical 'AND'. */
["faculty_bool_exp"]: {
	_and?: Array<ValueTypes["faculty_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["faculty_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["faculty_bool_exp"]> | undefined | null | Variable<any, string>,
	address?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	cast?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	date_of_joining?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	designation?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	dob?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	email_id?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	experience?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	faculty_fundings?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>,
	faculty_fundings_aggregate?: ValueTypes["faculty_funding_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	fdp_pdps?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>,
	fdp_pdps_aggregate?: ValueTypes["fdp_pdp_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	gender?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_bool_exp"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	job_type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	minority?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	pan_card_no?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	phone?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	qualification?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	section?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	staff_type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	status_of_approval?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "faculty" */
["faculty_constraint"]:faculty_constraint;
	/** columns and relationships of "faculty_funding" */
["faculty_funding"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	/** An object relationship */
	faculty?:ValueTypes["faculty"],
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	/** An object relationship */
	institute?:ValueTypes["institute"],
	institute_id?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "faculty_funding" */
["faculty_funding_aggregate"]: AliasType<{
	aggregate?:ValueTypes["faculty_funding_aggregate_fields"],
	nodes?:ValueTypes["faculty_funding"],
		__typename?: boolean | `@${string}`
}>;
	["faculty_funding_aggregate_bool_exp"]: {
	count?: ValueTypes["faculty_funding_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["faculty_funding_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["faculty_funding_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "faculty_funding" */
["faculty_funding_aggregate_fields"]: AliasType<{
	avg?:ValueTypes["faculty_funding_avg_fields"],
count?: [{	columns?: Array<ValueTypes["faculty_funding_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["faculty_funding_max_fields"],
	min?:ValueTypes["faculty_funding_min_fields"],
	stddev?:ValueTypes["faculty_funding_stddev_fields"],
	stddev_pop?:ValueTypes["faculty_funding_stddev_pop_fields"],
	stddev_samp?:ValueTypes["faculty_funding_stddev_samp_fields"],
	sum?:ValueTypes["faculty_funding_sum_fields"],
	var_pop?:ValueTypes["faculty_funding_var_pop_fields"],
	var_samp?:ValueTypes["faculty_funding_var_samp_fields"],
	variance?:ValueTypes["faculty_funding_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "faculty_funding" */
["faculty_funding_aggregate_order_by"]: {
	avg?: ValueTypes["faculty_funding_avg_order_by"] | undefined | null | Variable<any, string>,
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["faculty_funding_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["faculty_funding_min_order_by"] | undefined | null | Variable<any, string>,
	stddev?: ValueTypes["faculty_funding_stddev_order_by"] | undefined | null | Variable<any, string>,
	stddev_pop?: ValueTypes["faculty_funding_stddev_pop_order_by"] | undefined | null | Variable<any, string>,
	stddev_samp?: ValueTypes["faculty_funding_stddev_samp_order_by"] | undefined | null | Variable<any, string>,
	sum?: ValueTypes["faculty_funding_sum_order_by"] | undefined | null | Variable<any, string>,
	var_pop?: ValueTypes["faculty_funding_var_pop_order_by"] | undefined | null | Variable<any, string>,
	var_samp?: ValueTypes["faculty_funding_var_samp_order_by"] | undefined | null | Variable<any, string>,
	variance?: ValueTypes["faculty_funding_variance_order_by"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "faculty_funding" */
["faculty_funding_arr_rel_insert_input"]: {
	data: Array<ValueTypes["faculty_funding_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["faculty_funding_on_conflict"] | undefined | null | Variable<any, string>
};
	/** aggregate avg on columns */
["faculty_funding_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "faculty_funding" */
["faculty_funding_avg_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "faculty_funding". All fields are combined with a logical 'AND'. */
["faculty_funding_bool_exp"]: {
	_and?: Array<ValueTypes["faculty_funding_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["faculty_funding_bool_exp"]> | undefined | null | Variable<any, string>,
	amount?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	faculty?: ValueTypes["faculty_bool_exp"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_bool_exp"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	transaction_type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "faculty_funding" */
["faculty_funding_constraint"]:faculty_funding_constraint;
	/** input type for incrementing numeric columns in table "faculty_funding" */
["faculty_funding_inc_input"]: {
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "faculty_funding" */
["faculty_funding_insert_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	faculty?: ValueTypes["faculty_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transaction_type?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["faculty_funding_max_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "faculty_funding" */
["faculty_funding_max_order_by"]: {
	amount?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["faculty_funding_min_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "faculty_funding" */
["faculty_funding_min_order_by"]: {
	amount?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "faculty_funding" */
["faculty_funding_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["faculty_funding"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "faculty_funding" */
["faculty_funding_on_conflict"]: {
	constraint: ValueTypes["faculty_funding_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["faculty_funding_update_column"]> | Variable<any, string>,
	where?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "faculty_funding". */
["faculty_funding_order_by"]: {
	amount?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	faculty?: ValueTypes["faculty_order_by"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: faculty_funding */
["faculty_funding_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "faculty_funding" */
["faculty_funding_select_column"]:faculty_funding_select_column;
	/** input type for updating data in table "faculty_funding" */
["faculty_funding_set_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transaction_type?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["faculty_funding_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "faculty_funding" */
["faculty_funding_stddev_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_pop on columns */
["faculty_funding_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "faculty_funding" */
["faculty_funding_stddev_pop_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_samp on columns */
["faculty_funding_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "faculty_funding" */
["faculty_funding_stddev_samp_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "faculty_funding" */
["faculty_funding_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["faculty_funding_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["faculty_funding_stream_cursor_value_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transaction_type?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["faculty_funding_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "faculty_funding" */
["faculty_funding_sum_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** update columns of table "faculty_funding" */
["faculty_funding_update_column"]:faculty_funding_update_column;
	["faculty_funding_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["faculty_funding_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["faculty_funding_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["faculty_funding_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["faculty_funding_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "faculty_funding" */
["faculty_funding_var_pop_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate var_samp on columns */
["faculty_funding_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "faculty_funding" */
["faculty_funding_var_samp_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate variance on columns */
["faculty_funding_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "faculty_funding" */
["faculty_funding_variance_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** input type for incrementing numeric columns in table "faculty" */
["faculty_inc_input"]: {
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "faculty" */
["faculty_insert_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	cast?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	date_of_joining?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	designation?: string | undefined | null | Variable<any, string>,
	dob?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	email_id?: string | undefined | null | Variable<any, string>,
	experience?: string | undefined | null | Variable<any, string>,
	faculty_fundings?: ValueTypes["faculty_funding_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	fdp_pdps?: ValueTypes["fdp_pdp_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	gender?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	job_type?: string | undefined | null | Variable<any, string>,
	minority?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	pan_card_no?: string | undefined | null | Variable<any, string>,
	phone?: string | undefined | null | Variable<any, string>,
	qualification?: string | undefined | null | Variable<any, string>,
	section?: string | undefined | null | Variable<any, string>,
	staff_type?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	status_of_approval?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["faculty_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_of_joining?:boolean | `@${string}`,
	designation?:boolean | `@${string}`,
	dob?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	experience?:boolean | `@${string}`,
	gender?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	job_type?:boolean | `@${string}`,
	minority?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pan_card_no?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	qualification?:boolean | `@${string}`,
	section?:boolean | `@${string}`,
	staff_type?:boolean | `@${string}`,
	status_of_approval?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "faculty" */
["faculty_max_order_by"]: {
	address?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cast?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	date_of_joining?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	designation?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	dob?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	email_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	experience?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	gender?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	job_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	minority?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	pan_card_no?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phone?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	qualification?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	section?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	staff_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status_of_approval?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["faculty_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_of_joining?:boolean | `@${string}`,
	designation?:boolean | `@${string}`,
	dob?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	experience?:boolean | `@${string}`,
	gender?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	job_type?:boolean | `@${string}`,
	minority?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pan_card_no?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	qualification?:boolean | `@${string}`,
	section?:boolean | `@${string}`,
	staff_type?:boolean | `@${string}`,
	status_of_approval?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "faculty" */
["faculty_min_order_by"]: {
	address?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cast?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	date_of_joining?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	designation?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	dob?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	email_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	experience?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	gender?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	job_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	minority?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	pan_card_no?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phone?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	qualification?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	section?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	staff_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status_of_approval?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "faculty" */
["faculty_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["faculty"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "faculty" */
["faculty_obj_rel_insert_input"]: {
	data: ValueTypes["faculty_insert_input"] | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["faculty_on_conflict"] | undefined | null | Variable<any, string>
};
	/** on_conflict condition type for table "faculty" */
["faculty_on_conflict"]: {
	constraint: ValueTypes["faculty_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["faculty_update_column"]> | Variable<any, string>,
	where?: ValueTypes["faculty_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "faculty". */
["faculty_order_by"]: {
	address?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cast?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	date_of_joining?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	designation?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	dob?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	email_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	experience?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	faculty_fundings_aggregate?: ValueTypes["faculty_funding_aggregate_order_by"] | undefined | null | Variable<any, string>,
	fdp_pdps_aggregate?: ValueTypes["fdp_pdp_aggregate_order_by"] | undefined | null | Variable<any, string>,
	gender?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	job_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	minority?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	pan_card_no?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phone?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	qualification?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	section?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	staff_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status_of_approval?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: faculty */
["faculty_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "faculty" */
["faculty_select_column"]:faculty_select_column;
	/** input type for updating data in table "faculty" */
["faculty_set_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	cast?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	date_of_joining?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	designation?: string | undefined | null | Variable<any, string>,
	dob?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	email_id?: string | undefined | null | Variable<any, string>,
	experience?: string | undefined | null | Variable<any, string>,
	gender?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	job_type?: string | undefined | null | Variable<any, string>,
	minority?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	pan_card_no?: string | undefined | null | Variable<any, string>,
	phone?: string | undefined | null | Variable<any, string>,
	qualification?: string | undefined | null | Variable<any, string>,
	section?: string | undefined | null | Variable<any, string>,
	staff_type?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	status_of_approval?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["faculty_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "faculty" */
["faculty_stddev_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_pop on columns */
["faculty_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "faculty" */
["faculty_stddev_pop_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_samp on columns */
["faculty_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "faculty" */
["faculty_stddev_samp_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "faculty" */
["faculty_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["faculty_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["faculty_stream_cursor_value_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	cast?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	date_of_joining?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	designation?: string | undefined | null | Variable<any, string>,
	dob?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	email_id?: string | undefined | null | Variable<any, string>,
	experience?: string | undefined | null | Variable<any, string>,
	gender?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	job_type?: string | undefined | null | Variable<any, string>,
	minority?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	pan_card_no?: string | undefined | null | Variable<any, string>,
	phone?: string | undefined | null | Variable<any, string>,
	qualification?: string | undefined | null | Variable<any, string>,
	section?: string | undefined | null | Variable<any, string>,
	staff_type?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	status_of_approval?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["faculty_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "faculty" */
["faculty_sum_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** update columns of table "faculty" */
["faculty_update_column"]:faculty_update_column;
	["faculty_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["faculty_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["faculty_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["faculty_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["faculty_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "faculty" */
["faculty_var_pop_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate var_samp on columns */
["faculty_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "faculty" */
["faculty_var_samp_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate variance on columns */
["faculty_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "faculty" */
["faculty_variance_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** columns and relationships of "fdp_pdp" */
["fdp_pdp"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_from?:boolean | `@${string}`,
	date_to?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	/** An object relationship */
	faculty?:ValueTypes["faculty"],
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	/** An object relationship */
	institute?:ValueTypes["institute"],
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "fdp_pdp" */
["fdp_pdp_aggregate"]: AliasType<{
	aggregate?:ValueTypes["fdp_pdp_aggregate_fields"],
	nodes?:ValueTypes["fdp_pdp"],
		__typename?: boolean | `@${string}`
}>;
	["fdp_pdp_aggregate_bool_exp"]: {
	count?: ValueTypes["fdp_pdp_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["fdp_pdp_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["fdp_pdp_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "fdp_pdp" */
["fdp_pdp_aggregate_fields"]: AliasType<{
	avg?:ValueTypes["fdp_pdp_avg_fields"],
count?: [{	columns?: Array<ValueTypes["fdp_pdp_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["fdp_pdp_max_fields"],
	min?:ValueTypes["fdp_pdp_min_fields"],
	stddev?:ValueTypes["fdp_pdp_stddev_fields"],
	stddev_pop?:ValueTypes["fdp_pdp_stddev_pop_fields"],
	stddev_samp?:ValueTypes["fdp_pdp_stddev_samp_fields"],
	sum?:ValueTypes["fdp_pdp_sum_fields"],
	var_pop?:ValueTypes["fdp_pdp_var_pop_fields"],
	var_samp?:ValueTypes["fdp_pdp_var_samp_fields"],
	variance?:ValueTypes["fdp_pdp_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "fdp_pdp" */
["fdp_pdp_aggregate_order_by"]: {
	avg?: ValueTypes["fdp_pdp_avg_order_by"] | undefined | null | Variable<any, string>,
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["fdp_pdp_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["fdp_pdp_min_order_by"] | undefined | null | Variable<any, string>,
	stddev?: ValueTypes["fdp_pdp_stddev_order_by"] | undefined | null | Variable<any, string>,
	stddev_pop?: ValueTypes["fdp_pdp_stddev_pop_order_by"] | undefined | null | Variable<any, string>,
	stddev_samp?: ValueTypes["fdp_pdp_stddev_samp_order_by"] | undefined | null | Variable<any, string>,
	sum?: ValueTypes["fdp_pdp_sum_order_by"] | undefined | null | Variable<any, string>,
	var_pop?: ValueTypes["fdp_pdp_var_pop_order_by"] | undefined | null | Variable<any, string>,
	var_samp?: ValueTypes["fdp_pdp_var_samp_order_by"] | undefined | null | Variable<any, string>,
	variance?: ValueTypes["fdp_pdp_variance_order_by"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "fdp_pdp" */
["fdp_pdp_arr_rel_insert_input"]: {
	data: Array<ValueTypes["fdp_pdp_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["fdp_pdp_on_conflict"] | undefined | null | Variable<any, string>
};
	/** aggregate avg on columns */
["fdp_pdp_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "fdp_pdp" */
["fdp_pdp_avg_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "fdp_pdp". All fields are combined with a logical 'AND'. */
["fdp_pdp_bool_exp"]: {
	_and?: Array<ValueTypes["fdp_pdp_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["fdp_pdp_bool_exp"]> | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	date_from?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	date_to?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	faculty?: ValueTypes["faculty_bool_exp"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_bool_exp"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	venue?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "fdp_pdp" */
["fdp_pdp_constraint"]:fdp_pdp_constraint;
	/** input type for incrementing numeric columns in table "fdp_pdp" */
["fdp_pdp_inc_input"]: {
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "fdp_pdp" */
["fdp_pdp_insert_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	date_from?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	date_to?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	faculty?: ValueTypes["faculty_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	venue?: string | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["fdp_pdp_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_from?:boolean | `@${string}`,
	date_to?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "fdp_pdp" */
["fdp_pdp_max_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	date_from?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	date_to?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	venue?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["fdp_pdp_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_from?:boolean | `@${string}`,
	date_to?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "fdp_pdp" */
["fdp_pdp_min_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	date_from?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	date_to?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	venue?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "fdp_pdp" */
["fdp_pdp_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["fdp_pdp"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "fdp_pdp" */
["fdp_pdp_on_conflict"]: {
	constraint: ValueTypes["fdp_pdp_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["fdp_pdp_update_column"]> | Variable<any, string>,
	where?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "fdp_pdp". */
["fdp_pdp_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	date_from?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	date_to?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	faculty?: ValueTypes["faculty_order_by"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	venue?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: fdp_pdp */
["fdp_pdp_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "fdp_pdp" */
["fdp_pdp_select_column"]:fdp_pdp_select_column;
	/** input type for updating data in table "fdp_pdp" */
["fdp_pdp_set_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	date_from?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	date_to?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	venue?: string | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["fdp_pdp_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "fdp_pdp" */
["fdp_pdp_stddev_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_pop on columns */
["fdp_pdp_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "fdp_pdp" */
["fdp_pdp_stddev_pop_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_samp on columns */
["fdp_pdp_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "fdp_pdp" */
["fdp_pdp_stddev_samp_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "fdp_pdp" */
["fdp_pdp_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["fdp_pdp_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["fdp_pdp_stream_cursor_value_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	date_from?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	date_to?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	venue?: string | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["fdp_pdp_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "fdp_pdp" */
["fdp_pdp_sum_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** update columns of table "fdp_pdp" */
["fdp_pdp_update_column"]:fdp_pdp_update_column;
	["fdp_pdp_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["fdp_pdp_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["fdp_pdp_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["fdp_pdp_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["fdp_pdp_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "fdp_pdp" */
["fdp_pdp_var_pop_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate var_samp on columns */
["fdp_pdp_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "fdp_pdp" */
["fdp_pdp_var_samp_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate variance on columns */
["fdp_pdp_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "fdp_pdp" */
["fdp_pdp_variance_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** columns and relationships of "genesis" */
["genesis"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isVerified?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "genesis" */
["genesis_aggregate"]: AliasType<{
	aggregate?:ValueTypes["genesis_aggregate_fields"],
	nodes?:ValueTypes["genesis"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "genesis" */
["genesis_aggregate_fields"]: AliasType<{
	avg?:ValueTypes["genesis_avg_fields"],
count?: [{	columns?: Array<ValueTypes["genesis_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["genesis_max_fields"],
	min?:ValueTypes["genesis_min_fields"],
	stddev?:ValueTypes["genesis_stddev_fields"],
	stddev_pop?:ValueTypes["genesis_stddev_pop_fields"],
	stddev_samp?:ValueTypes["genesis_stddev_samp_fields"],
	sum?:ValueTypes["genesis_sum_fields"],
	var_pop?:ValueTypes["genesis_var_pop_fields"],
	var_samp?:ValueTypes["genesis_var_samp_fields"],
	variance?:ValueTypes["genesis_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["genesis_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "genesis". All fields are combined with a logical 'AND'. */
["genesis_bool_exp"]: {
	_and?: Array<ValueTypes["genesis_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["genesis_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["genesis_bool_exp"]> | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	email_id?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	isVerified?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	phone?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "genesis" */
["genesis_constraint"]:genesis_constraint;
	/** input type for incrementing numeric columns in table "genesis" */
["genesis_inc_input"]: {
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "genesis" */
["genesis_insert_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	email_id?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isVerified?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phone?: string | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["genesis_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isVerified?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["genesis_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isVerified?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "genesis" */
["genesis_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["genesis"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "genesis" */
["genesis_on_conflict"]: {
	constraint: ValueTypes["genesis_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["genesis_update_column"]> | Variable<any, string>,
	where?: ValueTypes["genesis_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "genesis". */
["genesis_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	email_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	isVerified?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phone?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: genesis */
["genesis_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "genesis" */
["genesis_select_column"]:genesis_select_column;
	/** input type for updating data in table "genesis" */
["genesis_set_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	email_id?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isVerified?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phone?: string | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["genesis_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["genesis_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["genesis_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Streaming cursor of the table "genesis" */
["genesis_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["genesis_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["genesis_stream_cursor_value_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	email_id?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isVerified?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phone?: string | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["genesis_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "genesis" */
["genesis_update_column"]:genesis_update_column;
	["genesis_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["genesis_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["genesis_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["genesis_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["genesis_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["genesis_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["genesis_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "institute" */
["institute"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_of_establishment?:boolean | `@${string}`,
e_governances?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["e_governance_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["e_governance_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["e_governance_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["e_governance"]],
e_governances_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["e_governance_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["e_governance_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["e_governance_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["e_governance_aggregate"]],
faculties?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty"]],
faculties_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty_aggregate"]],
faculty_fundings?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty_funding"]],
faculty_fundings_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty_funding_aggregate"]],
fdp_pdps?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["fdp_pdp_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["fdp_pdp_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["fdp_pdp"]],
fdp_pdps_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["fdp_pdp_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["fdp_pdp_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["fdp_pdp_aggregate"]],
	id?:boolean | `@${string}`,
institute_fundings?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["institute_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["institute_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["institute_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["institute_funding"]],
institute_fundings_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["institute_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["institute_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["institute_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["institute_funding_aggregate"]],
	landmark?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pin?:boolean | `@${string}`,
	state?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "institute" */
["institute_aggregate"]: AliasType<{
	aggregate?:ValueTypes["institute_aggregate_fields"],
	nodes?:ValueTypes["institute"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "institute" */
["institute_aggregate_fields"]: AliasType<{
	avg?:ValueTypes["institute_avg_fields"],
count?: [{	columns?: Array<ValueTypes["institute_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["institute_max_fields"],
	min?:ValueTypes["institute_min_fields"],
	stddev?:ValueTypes["institute_stddev_fields"],
	stddev_pop?:ValueTypes["institute_stddev_pop_fields"],
	stddev_samp?:ValueTypes["institute_stddev_samp_fields"],
	sum?:ValueTypes["institute_sum_fields"],
	var_pop?:ValueTypes["institute_var_pop_fields"],
	var_samp?:ValueTypes["institute_var_samp_fields"],
	variance?:ValueTypes["institute_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["institute_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "institute". All fields are combined with a logical 'AND'. */
["institute_bool_exp"]: {
	_and?: Array<ValueTypes["institute_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["institute_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["institute_bool_exp"]> | undefined | null | Variable<any, string>,
	address?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	city?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	date_of_establishment?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	e_governances?: ValueTypes["e_governance_bool_exp"] | undefined | null | Variable<any, string>,
	e_governances_aggregate?: ValueTypes["e_governance_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	faculties?: ValueTypes["faculty_bool_exp"] | undefined | null | Variable<any, string>,
	faculties_aggregate?: ValueTypes["faculty_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	faculty_fundings?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>,
	faculty_fundings_aggregate?: ValueTypes["faculty_funding_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	fdp_pdps?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>,
	fdp_pdps_aggregate?: ValueTypes["fdp_pdp_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	institute_fundings?: ValueTypes["institute_funding_bool_exp"] | undefined | null | Variable<any, string>,
	institute_fundings_aggregate?: ValueTypes["institute_funding_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	landmark?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	pin?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	state?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	website?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "institute" */
["institute_constraint"]:institute_constraint;
	/** columns and relationships of "institute_funding" */
["institute_funding"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	/** An object relationship */
	institute?:ValueTypes["institute"],
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "institute_funding" */
["institute_funding_aggregate"]: AliasType<{
	aggregate?:ValueTypes["institute_funding_aggregate_fields"],
	nodes?:ValueTypes["institute_funding"],
		__typename?: boolean | `@${string}`
}>;
	["institute_funding_aggregate_bool_exp"]: {
	count?: ValueTypes["institute_funding_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["institute_funding_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["institute_funding_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["institute_funding_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "institute_funding" */
["institute_funding_aggregate_fields"]: AliasType<{
	avg?:ValueTypes["institute_funding_avg_fields"],
count?: [{	columns?: Array<ValueTypes["institute_funding_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["institute_funding_max_fields"],
	min?:ValueTypes["institute_funding_min_fields"],
	stddev?:ValueTypes["institute_funding_stddev_fields"],
	stddev_pop?:ValueTypes["institute_funding_stddev_pop_fields"],
	stddev_samp?:ValueTypes["institute_funding_stddev_samp_fields"],
	sum?:ValueTypes["institute_funding_sum_fields"],
	var_pop?:ValueTypes["institute_funding_var_pop_fields"],
	var_samp?:ValueTypes["institute_funding_var_samp_fields"],
	variance?:ValueTypes["institute_funding_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "institute_funding" */
["institute_funding_aggregate_order_by"]: {
	avg?: ValueTypes["institute_funding_avg_order_by"] | undefined | null | Variable<any, string>,
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["institute_funding_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["institute_funding_min_order_by"] | undefined | null | Variable<any, string>,
	stddev?: ValueTypes["institute_funding_stddev_order_by"] | undefined | null | Variable<any, string>,
	stddev_pop?: ValueTypes["institute_funding_stddev_pop_order_by"] | undefined | null | Variable<any, string>,
	stddev_samp?: ValueTypes["institute_funding_stddev_samp_order_by"] | undefined | null | Variable<any, string>,
	sum?: ValueTypes["institute_funding_sum_order_by"] | undefined | null | Variable<any, string>,
	var_pop?: ValueTypes["institute_funding_var_pop_order_by"] | undefined | null | Variable<any, string>,
	var_samp?: ValueTypes["institute_funding_var_samp_order_by"] | undefined | null | Variable<any, string>,
	variance?: ValueTypes["institute_funding_variance_order_by"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "institute_funding" */
["institute_funding_arr_rel_insert_input"]: {
	data: Array<ValueTypes["institute_funding_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["institute_funding_on_conflict"] | undefined | null | Variable<any, string>
};
	/** aggregate avg on columns */
["institute_funding_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "institute_funding" */
["institute_funding_avg_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "institute_funding". All fields are combined with a logical 'AND'. */
["institute_funding_bool_exp"]: {
	_and?: Array<ValueTypes["institute_funding_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["institute_funding_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["institute_funding_bool_exp"]> | undefined | null | Variable<any, string>,
	amount?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_bool_exp"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	purpose?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	transaction_type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "institute_funding" */
["institute_funding_constraint"]:institute_funding_constraint;
	/** input type for incrementing numeric columns in table "institute_funding" */
["institute_funding_inc_input"]: {
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "institute_funding" */
["institute_funding_insert_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	purpose?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transaction_type?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["institute_funding_max_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "institute_funding" */
["institute_funding_max_order_by"]: {
	amount?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	purpose?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["institute_funding_min_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "institute_funding" */
["institute_funding_min_order_by"]: {
	amount?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	purpose?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "institute_funding" */
["institute_funding_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["institute_funding"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "institute_funding" */
["institute_funding_on_conflict"]: {
	constraint: ValueTypes["institute_funding_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["institute_funding_update_column"]> | Variable<any, string>,
	where?: ValueTypes["institute_funding_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "institute_funding". */
["institute_funding_order_by"]: {
	amount?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute?: ValueTypes["institute_order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	purpose?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: institute_funding */
["institute_funding_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "institute_funding" */
["institute_funding_select_column"]:institute_funding_select_column;
	/** input type for updating data in table "institute_funding" */
["institute_funding_set_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	purpose?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transaction_type?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["institute_funding_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "institute_funding" */
["institute_funding_stddev_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_pop on columns */
["institute_funding_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "institute_funding" */
["institute_funding_stddev_pop_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_samp on columns */
["institute_funding_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "institute_funding" */
["institute_funding_stddev_samp_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "institute_funding" */
["institute_funding_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["institute_funding_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["institute_funding_stream_cursor_value_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	purpose?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transaction_type?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["institute_funding_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "institute_funding" */
["institute_funding_sum_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** update columns of table "institute_funding" */
["institute_funding_update_column"]:institute_funding_update_column;
	["institute_funding_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["institute_funding_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["institute_funding_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["institute_funding_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["institute_funding_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "institute_funding" */
["institute_funding_var_pop_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate var_samp on columns */
["institute_funding_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "institute_funding" */
["institute_funding_var_samp_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate variance on columns */
["institute_funding_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "institute_funding" */
["institute_funding_variance_order_by"]: {
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** input type for incrementing numeric columns in table "institute" */
["institute_inc_input"]: {
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "institute" */
["institute_insert_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	city?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	date_of_establishment?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	e_governances?: ValueTypes["e_governance_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	faculties?: ValueTypes["faculty_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	faculty_fundings?: ValueTypes["faculty_funding_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	fdp_pdps?: ValueTypes["fdp_pdp_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_fundings?: ValueTypes["institute_funding_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	landmark?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	pin?: string | undefined | null | Variable<any, string>,
	state?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["institute_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_of_establishment?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	landmark?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pin?:boolean | `@${string}`,
	state?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["institute_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_of_establishment?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	landmark?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pin?:boolean | `@${string}`,
	state?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "institute" */
["institute_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["institute"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "institute" */
["institute_obj_rel_insert_input"]: {
	data: ValueTypes["institute_insert_input"] | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["institute_on_conflict"] | undefined | null | Variable<any, string>
};
	/** on_conflict condition type for table "institute" */
["institute_on_conflict"]: {
	constraint: ValueTypes["institute_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["institute_update_column"]> | Variable<any, string>,
	where?: ValueTypes["institute_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "institute". */
["institute_order_by"]: {
	address?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	city?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	date_of_establishment?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	e_governances_aggregate?: ValueTypes["e_governance_aggregate_order_by"] | undefined | null | Variable<any, string>,
	faculties_aggregate?: ValueTypes["faculty_aggregate_order_by"] | undefined | null | Variable<any, string>,
	faculty_fundings_aggregate?: ValueTypes["faculty_funding_aggregate_order_by"] | undefined | null | Variable<any, string>,
	fdp_pdps_aggregate?: ValueTypes["fdp_pdp_aggregate_order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_fundings_aggregate?: ValueTypes["institute_funding_aggregate_order_by"] | undefined | null | Variable<any, string>,
	landmark?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	pin?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	state?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	website?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: institute */
["institute_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "institute" */
["institute_select_column"]:institute_select_column;
	/** input type for updating data in table "institute" */
["institute_set_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	city?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	date_of_establishment?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	landmark?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	pin?: string | undefined | null | Variable<any, string>,
	state?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["institute_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["institute_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["institute_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Streaming cursor of the table "institute" */
["institute_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["institute_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["institute_stream_cursor_value_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	city?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	date_of_establishment?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	landmark?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	pin?: string | undefined | null | Variable<any, string>,
	state?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["STATUS_enum"] | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["institute_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "institute" */
["institute_update_column"]:institute_update_column;
	["institute_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["institute_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["institute_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["institute_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["institute_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["institute_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["institute_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** mutation root */
["mutation_root"]: AliasType<{
delete_STATUS?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["STATUS_bool_exp"] | Variable<any, string>},ValueTypes["STATUS_mutation_response"]],
delete_STATUS_by_pk?: [{	value: string | Variable<any, string>},ValueTypes["STATUS"]],
delete_e_governance?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["e_governance_bool_exp"] | Variable<any, string>},ValueTypes["e_governance_mutation_response"]],
delete_e_governance_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["e_governance"]],
delete_faculty?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["faculty_bool_exp"] | Variable<any, string>},ValueTypes["faculty_mutation_response"]],
delete_faculty_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["faculty"]],
delete_faculty_funding?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["faculty_funding_bool_exp"] | Variable<any, string>},ValueTypes["faculty_funding_mutation_response"]],
delete_faculty_funding_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["faculty_funding"]],
delete_fdp_pdp?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["fdp_pdp_bool_exp"] | Variable<any, string>},ValueTypes["fdp_pdp_mutation_response"]],
delete_fdp_pdp_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["fdp_pdp"]],
delete_genesis?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["genesis_bool_exp"] | Variable<any, string>},ValueTypes["genesis_mutation_response"]],
delete_genesis_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["genesis"]],
delete_institute?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["institute_bool_exp"] | Variable<any, string>},ValueTypes["institute_mutation_response"]],
delete_institute_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["institute"]],
delete_institute_funding?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["institute_funding_bool_exp"] | Variable<any, string>},ValueTypes["institute_funding_mutation_response"]],
delete_institute_funding_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["institute_funding"]],
insert_STATUS?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["STATUS_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["STATUS_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["STATUS_mutation_response"]],
insert_STATUS_one?: [{	/** the row to be inserted */
	object: ValueTypes["STATUS_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["STATUS_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["STATUS"]],
insert_e_governance?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["e_governance_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["e_governance_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["e_governance_mutation_response"]],
insert_e_governance_one?: [{	/** the row to be inserted */
	object: ValueTypes["e_governance_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["e_governance_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["e_governance"]],
insert_faculty?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["faculty_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["faculty_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["faculty_mutation_response"]],
insert_faculty_funding?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["faculty_funding_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["faculty_funding_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["faculty_funding_mutation_response"]],
insert_faculty_funding_one?: [{	/** the row to be inserted */
	object: ValueTypes["faculty_funding_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["faculty_funding_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["faculty_funding"]],
insert_faculty_one?: [{	/** the row to be inserted */
	object: ValueTypes["faculty_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["faculty_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["faculty"]],
insert_fdp_pdp?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["fdp_pdp_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["fdp_pdp_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["fdp_pdp_mutation_response"]],
insert_fdp_pdp_one?: [{	/** the row to be inserted */
	object: ValueTypes["fdp_pdp_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["fdp_pdp_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["fdp_pdp"]],
insert_genesis?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["genesis_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["genesis_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["genesis_mutation_response"]],
insert_genesis_one?: [{	/** the row to be inserted */
	object: ValueTypes["genesis_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["genesis_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["genesis"]],
insert_institute?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["institute_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["institute_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["institute_mutation_response"]],
insert_institute_funding?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["institute_funding_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["institute_funding_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["institute_funding_mutation_response"]],
insert_institute_funding_one?: [{	/** the row to be inserted */
	object: ValueTypes["institute_funding_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["institute_funding_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["institute_funding"]],
insert_institute_one?: [{	/** the row to be inserted */
	object: ValueTypes["institute_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["institute_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["institute"]],
update_STATUS?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["STATUS_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["STATUS_bool_exp"] | Variable<any, string>},ValueTypes["STATUS_mutation_response"]],
update_STATUS_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["STATUS_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["STATUS_pk_columns_input"] | Variable<any, string>},ValueTypes["STATUS"]],
update_STATUS_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["STATUS_updates"]> | Variable<any, string>},ValueTypes["STATUS_mutation_response"]],
update_e_governance?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["e_governance_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["e_governance_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["e_governance_bool_exp"] | Variable<any, string>},ValueTypes["e_governance_mutation_response"]],
update_e_governance_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["e_governance_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["e_governance_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["e_governance_pk_columns_input"] | Variable<any, string>},ValueTypes["e_governance"]],
update_e_governance_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["e_governance_updates"]> | Variable<any, string>},ValueTypes["e_governance_mutation_response"]],
update_faculty?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["faculty_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["faculty_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["faculty_bool_exp"] | Variable<any, string>},ValueTypes["faculty_mutation_response"]],
update_faculty_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["faculty_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["faculty_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["faculty_pk_columns_input"] | Variable<any, string>},ValueTypes["faculty"]],
update_faculty_funding?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["faculty_funding_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["faculty_funding_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["faculty_funding_bool_exp"] | Variable<any, string>},ValueTypes["faculty_funding_mutation_response"]],
update_faculty_funding_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["faculty_funding_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["faculty_funding_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["faculty_funding_pk_columns_input"] | Variable<any, string>},ValueTypes["faculty_funding"]],
update_faculty_funding_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["faculty_funding_updates"]> | Variable<any, string>},ValueTypes["faculty_funding_mutation_response"]],
update_faculty_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["faculty_updates"]> | Variable<any, string>},ValueTypes["faculty_mutation_response"]],
update_fdp_pdp?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["fdp_pdp_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["fdp_pdp_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["fdp_pdp_bool_exp"] | Variable<any, string>},ValueTypes["fdp_pdp_mutation_response"]],
update_fdp_pdp_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["fdp_pdp_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["fdp_pdp_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["fdp_pdp_pk_columns_input"] | Variable<any, string>},ValueTypes["fdp_pdp"]],
update_fdp_pdp_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["fdp_pdp_updates"]> | Variable<any, string>},ValueTypes["fdp_pdp_mutation_response"]],
update_genesis?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["genesis_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["genesis_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["genesis_bool_exp"] | Variable<any, string>},ValueTypes["genesis_mutation_response"]],
update_genesis_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["genesis_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["genesis_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["genesis_pk_columns_input"] | Variable<any, string>},ValueTypes["genesis"]],
update_genesis_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["genesis_updates"]> | Variable<any, string>},ValueTypes["genesis_mutation_response"]],
update_institute?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["institute_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["institute_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["institute_bool_exp"] | Variable<any, string>},ValueTypes["institute_mutation_response"]],
update_institute_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["institute_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["institute_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["institute_pk_columns_input"] | Variable<any, string>},ValueTypes["institute"]],
update_institute_funding?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["institute_funding_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["institute_funding_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["institute_funding_bool_exp"] | Variable<any, string>},ValueTypes["institute_funding_mutation_response"]],
update_institute_funding_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["institute_funding_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["institute_funding_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["institute_funding_pk_columns_input"] | Variable<any, string>},ValueTypes["institute_funding"]],
update_institute_funding_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["institute_funding_updates"]> | Variable<any, string>},ValueTypes["institute_funding_mutation_response"]],
update_institute_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["institute_updates"]> | Variable<any, string>},ValueTypes["institute_mutation_response"]],
		__typename?: boolean | `@${string}`
}>;
	/** column ordering options */
["order_by"]:order_by;
	["query_root"]: AliasType<{
STATUS?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["STATUS_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["STATUS_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["STATUS_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["STATUS"]],
STATUS_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["STATUS_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["STATUS_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["STATUS_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["STATUS_aggregate"]],
STATUS_by_pk?: [{	value: string | Variable<any, string>},ValueTypes["STATUS"]],
e_governance?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["e_governance_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["e_governance_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["e_governance_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["e_governance"]],
e_governance_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["e_governance_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["e_governance_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["e_governance_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["e_governance_aggregate"]],
e_governance_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["e_governance"]],
faculty?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty"]],
faculty_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty_aggregate"]],
faculty_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["faculty"]],
faculty_funding?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty_funding"]],
faculty_funding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty_funding_aggregate"]],
faculty_funding_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["faculty_funding"]],
fdp_pdp?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["fdp_pdp_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["fdp_pdp_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["fdp_pdp"]],
fdp_pdp_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["fdp_pdp_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["fdp_pdp_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["fdp_pdp_aggregate"]],
fdp_pdp_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["fdp_pdp"]],
genesis?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["genesis_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["genesis_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["genesis_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["genesis"]],
genesis_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["genesis_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["genesis_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["genesis_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["genesis_aggregate"]],
genesis_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["genesis"]],
institute?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["institute_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["institute_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["institute_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["institute"]],
institute_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["institute_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["institute_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["institute_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["institute_aggregate"]],
institute_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["institute"]],
institute_funding?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["institute_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["institute_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["institute_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["institute_funding"]],
institute_funding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["institute_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["institute_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["institute_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["institute_funding_aggregate"]],
institute_funding_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["institute_funding"]],
		__typename?: boolean | `@${string}`
}>;
	["subscription_root"]: AliasType<{
STATUS?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["STATUS_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["STATUS_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["STATUS_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["STATUS"]],
STATUS_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["STATUS_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["STATUS_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["STATUS_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["STATUS_aggregate"]],
STATUS_by_pk?: [{	value: string | Variable<any, string>},ValueTypes["STATUS"]],
STATUS_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["STATUS_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["STATUS_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["STATUS"]],
e_governance?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["e_governance_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["e_governance_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["e_governance_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["e_governance"]],
e_governance_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["e_governance_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["e_governance_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["e_governance_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["e_governance_aggregate"]],
e_governance_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["e_governance"]],
e_governance_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["e_governance_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["e_governance_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["e_governance"]],
faculty?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty"]],
faculty_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty_aggregate"]],
faculty_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["faculty"]],
faculty_funding?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty_funding"]],
faculty_funding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["faculty_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["faculty_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty_funding_aggregate"]],
faculty_funding_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["faculty_funding"]],
faculty_funding_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["faculty_funding_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty_funding"]],
faculty_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["faculty_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["faculty_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["faculty"]],
fdp_pdp?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["fdp_pdp_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["fdp_pdp_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["fdp_pdp"]],
fdp_pdp_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["fdp_pdp_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["fdp_pdp_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["fdp_pdp_aggregate"]],
fdp_pdp_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["fdp_pdp"]],
fdp_pdp_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["fdp_pdp_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["fdp_pdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["fdp_pdp"]],
genesis?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["genesis_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["genesis_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["genesis_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["genesis"]],
genesis_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["genesis_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["genesis_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["genesis_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["genesis_aggregate"]],
genesis_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["genesis"]],
genesis_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["genesis_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["genesis_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["genesis"]],
institute?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["institute_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["institute_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["institute_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["institute"]],
institute_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["institute_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["institute_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["institute_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["institute_aggregate"]],
institute_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["institute"]],
institute_funding?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["institute_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["institute_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["institute_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["institute_funding"]],
institute_funding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["institute_funding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["institute_funding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["institute_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["institute_funding_aggregate"]],
institute_funding_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["institute_funding"]],
institute_funding_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["institute_funding_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["institute_funding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["institute_funding"]],
institute_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["institute_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["institute_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["institute"]],
		__typename?: boolean | `@${string}`
}>;
	["timestamptz"]:unknown;
	/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
["timestamptz_comparison_exp"]: {
	_eq?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	_gt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	_gte?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["timestamptz"]> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	_lte?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["timestamptz"]> | undefined | null | Variable<any, string>
};
	["uuid"]:unknown;
	/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
["uuid_comparison_exp"]: {
	_eq?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	_gt?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	_gte?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["uuid"]> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	_lte?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["uuid"]> | undefined | null | Variable<any, string>
}
  }

export type ResolverInputTypes = {
    ["schema"]: AliasType<{
	query?:ResolverInputTypes["query_root"],
	mutation?:ResolverInputTypes["mutation_root"],
	subscription?:ResolverInputTypes["subscription_root"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
["Int_comparison_exp"]: {
	_eq?: number | undefined | null,
	_gt?: number | undefined | null,
	_gte?: number | undefined | null,
	_in?: Array<number> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: number | undefined | null,
	_lte?: number | undefined | null,
	_neq?: number | undefined | null,
	_nin?: Array<number> | undefined | null
};
	/** columns and relationships of "STATUS" */
["STATUS"]: AliasType<{
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "STATUS" */
["STATUS_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["STATUS_aggregate_fields"],
	nodes?:ResolverInputTypes["STATUS"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "STATUS" */
["STATUS_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["STATUS_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["STATUS_max_fields"],
	min?:ResolverInputTypes["STATUS_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "STATUS". All fields are combined with a logical 'AND'. */
["STATUS_bool_exp"]: {
	_and?: Array<ResolverInputTypes["STATUS_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["STATUS_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["STATUS_bool_exp"]> | undefined | null,
	value?: ResolverInputTypes["String_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "STATUS" */
["STATUS_constraint"]:STATUS_constraint;
	["STATUS_enum"]:STATUS_enum;
	/** Boolean expression to compare columns of type "STATUS_enum". All fields are combined with logical 'AND'. */
["STATUS_enum_comparison_exp"]: {
	_eq?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	_in?: Array<ResolverInputTypes["STATUS_enum"]> | undefined | null,
	_is_null?: boolean | undefined | null,
	_neq?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	_nin?: Array<ResolverInputTypes["STATUS_enum"]> | undefined | null
};
	/** input type for inserting data into table "STATUS" */
["STATUS_insert_input"]: {
	value?: string | undefined | null
};
	/** aggregate max on columns */
["STATUS_max_fields"]: AliasType<{
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["STATUS_min_fields"]: AliasType<{
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "STATUS" */
["STATUS_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["STATUS"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "STATUS" */
["STATUS_on_conflict"]: {
	constraint: ResolverInputTypes["STATUS_constraint"],
	update_columns: Array<ResolverInputTypes["STATUS_update_column"]>,
	where?: ResolverInputTypes["STATUS_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "STATUS". */
["STATUS_order_by"]: {
	value?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: STATUS */
["STATUS_pk_columns_input"]: {
	value: string
};
	/** select columns of table "STATUS" */
["STATUS_select_column"]:STATUS_select_column;
	/** input type for updating data in table "STATUS" */
["STATUS_set_input"]: {
	value?: string | undefined | null
};
	/** Streaming cursor of the table "STATUS" */
["STATUS_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["STATUS_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["STATUS_stream_cursor_value_input"]: {
	value?: string | undefined | null
};
	/** update columns of table "STATUS" */
["STATUS_update_column"]:STATUS_update_column;
	["STATUS_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["STATUS_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["STATUS_bool_exp"]
};
	/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
["String_comparison_exp"]: {
	_eq?: string | undefined | null,
	_gt?: string | undefined | null,
	_gte?: string | undefined | null,
	/** does the column match the given case-insensitive pattern */
	_ilike?: string | undefined | null,
	_in?: Array<string> | undefined | null,
	/** does the column match the given POSIX regular expression, case insensitive */
	_iregex?: string | undefined | null,
	_is_null?: boolean | undefined | null,
	/** does the column match the given pattern */
	_like?: string | undefined | null,
	_lt?: string | undefined | null,
	_lte?: string | undefined | null,
	_neq?: string | undefined | null,
	/** does the column NOT match the given case-insensitive pattern */
	_nilike?: string | undefined | null,
	_nin?: Array<string> | undefined | null,
	/** does the column NOT match the given POSIX regular expression, case insensitive */
	_niregex?: string | undefined | null,
	/** does the column NOT match the given pattern */
	_nlike?: string | undefined | null,
	/** does the column NOT match the given POSIX regular expression, case sensitive */
	_nregex?: string | undefined | null,
	/** does the column NOT match the given SQL regular expression */
	_nsimilar?: string | undefined | null,
	/** does the column match the given POSIX regular expression, case sensitive */
	_regex?: string | undefined | null,
	/** does the column match the given SQL regular expression */
	_similar?: string | undefined | null
};
	["bigint"]:unknown;
	/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
["bigint_comparison_exp"]: {
	_eq?: ResolverInputTypes["bigint"] | undefined | null,
	_gt?: ResolverInputTypes["bigint"] | undefined | null,
	_gte?: ResolverInputTypes["bigint"] | undefined | null,
	_in?: Array<ResolverInputTypes["bigint"]> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: ResolverInputTypes["bigint"] | undefined | null,
	_lte?: ResolverInputTypes["bigint"] | undefined | null,
	_neq?: ResolverInputTypes["bigint"] | undefined | null,
	_nin?: Array<ResolverInputTypes["bigint"]> | undefined | null
};
	/** ordering argument of a cursor */
["cursor_ordering"]:cursor_ordering;
	["date"]:unknown;
	/** Boolean expression to compare columns of type "date". All fields are combined with logical 'AND'. */
["date_comparison_exp"]: {
	_eq?: ResolverInputTypes["date"] | undefined | null,
	_gt?: ResolverInputTypes["date"] | undefined | null,
	_gte?: ResolverInputTypes["date"] | undefined | null,
	_in?: Array<ResolverInputTypes["date"]> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: ResolverInputTypes["date"] | undefined | null,
	_lte?: ResolverInputTypes["date"] | undefined | null,
	_neq?: ResolverInputTypes["date"] | undefined | null,
	_nin?: Array<ResolverInputTypes["date"]> | undefined | null
};
	/** columns and relationships of "e_governance" */
["e_governance"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	/** An object relationship */
	institute?:ResolverInputTypes["institute"],
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone_no?:boolean | `@${string}`,
	service_end_date?:boolean | `@${string}`,
	service_start_date?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	total_amount?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "e_governance" */
["e_governance_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["e_governance_aggregate_fields"],
	nodes?:ResolverInputTypes["e_governance"],
		__typename?: boolean | `@${string}`
}>;
	["e_governance_aggregate_bool_exp"]: {
	count?: ResolverInputTypes["e_governance_aggregate_bool_exp_count"] | undefined | null
};
	["e_governance_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["e_governance_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["e_governance_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "e_governance" */
["e_governance_aggregate_fields"]: AliasType<{
	avg?:ResolverInputTypes["e_governance_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["e_governance_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["e_governance_max_fields"],
	min?:ResolverInputTypes["e_governance_min_fields"],
	stddev?:ResolverInputTypes["e_governance_stddev_fields"],
	stddev_pop?:ResolverInputTypes["e_governance_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["e_governance_stddev_samp_fields"],
	sum?:ResolverInputTypes["e_governance_sum_fields"],
	var_pop?:ResolverInputTypes["e_governance_var_pop_fields"],
	var_samp?:ResolverInputTypes["e_governance_var_samp_fields"],
	variance?:ResolverInputTypes["e_governance_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "e_governance" */
["e_governance_aggregate_order_by"]: {
	avg?: ResolverInputTypes["e_governance_avg_order_by"] | undefined | null,
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["e_governance_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["e_governance_min_order_by"] | undefined | null,
	stddev?: ResolverInputTypes["e_governance_stddev_order_by"] | undefined | null,
	stddev_pop?: ResolverInputTypes["e_governance_stddev_pop_order_by"] | undefined | null,
	stddev_samp?: ResolverInputTypes["e_governance_stddev_samp_order_by"] | undefined | null,
	sum?: ResolverInputTypes["e_governance_sum_order_by"] | undefined | null,
	var_pop?: ResolverInputTypes["e_governance_var_pop_order_by"] | undefined | null,
	var_samp?: ResolverInputTypes["e_governance_var_samp_order_by"] | undefined | null,
	variance?: ResolverInputTypes["e_governance_variance_order_by"] | undefined | null
};
	/** input type for inserting array relation for remote table "e_governance" */
["e_governance_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["e_governance_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["e_governance_on_conflict"] | undefined | null
};
	/** aggregate avg on columns */
["e_governance_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "e_governance" */
["e_governance_avg_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Boolean expression to filter rows from the table "e_governance". All fields are combined with a logical 'AND'. */
["e_governance_bool_exp"]: {
	_and?: Array<ResolverInputTypes["e_governance_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["e_governance_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["e_governance_bool_exp"]> | undefined | null,
	address?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	area?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	description?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	file?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	institute?: ResolverInputTypes["institute_bool_exp"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	phone_no?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	service_end_date?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	service_start_date?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["STATUS_enum_comparison_exp"] | undefined | null,
	total_amount?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	website?: ResolverInputTypes["String_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "e_governance" */
["e_governance_constraint"]:e_governance_constraint;
	/** input type for incrementing numeric columns in table "e_governance" */
["e_governance_inc_input"]: {
	cursorId?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "e_governance" */
["e_governance_insert_input"]: {
	address?: string | undefined | null,
	area?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	description?: string | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute?: ResolverInputTypes["institute_obj_rel_insert_input"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	phone_no?: string | undefined | null,
	service_end_date?: ResolverInputTypes["date"] | undefined | null,
	service_start_date?: ResolverInputTypes["date"] | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	total_amount?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate max on columns */
["e_governance_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone_no?:boolean | `@${string}`,
	service_end_date?:boolean | `@${string}`,
	service_start_date?:boolean | `@${string}`,
	total_amount?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "e_governance" */
["e_governance_max_order_by"]: {
	address?: ResolverInputTypes["order_by"] | undefined | null,
	area?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	description?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	phone_no?: ResolverInputTypes["order_by"] | undefined | null,
	service_end_date?: ResolverInputTypes["order_by"] | undefined | null,
	service_start_date?: ResolverInputTypes["order_by"] | undefined | null,
	total_amount?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
	website?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["e_governance_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone_no?:boolean | `@${string}`,
	service_end_date?:boolean | `@${string}`,
	service_start_date?:boolean | `@${string}`,
	total_amount?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "e_governance" */
["e_governance_min_order_by"]: {
	address?: ResolverInputTypes["order_by"] | undefined | null,
	area?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	description?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	phone_no?: ResolverInputTypes["order_by"] | undefined | null,
	service_end_date?: ResolverInputTypes["order_by"] | undefined | null,
	service_start_date?: ResolverInputTypes["order_by"] | undefined | null,
	total_amount?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
	website?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "e_governance" */
["e_governance_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["e_governance"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "e_governance" */
["e_governance_on_conflict"]: {
	constraint: ResolverInputTypes["e_governance_constraint"],
	update_columns: Array<ResolverInputTypes["e_governance_update_column"]>,
	where?: ResolverInputTypes["e_governance_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "e_governance". */
["e_governance_order_by"]: {
	address?: ResolverInputTypes["order_by"] | undefined | null,
	area?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	description?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute?: ResolverInputTypes["institute_order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	phone_no?: ResolverInputTypes["order_by"] | undefined | null,
	service_end_date?: ResolverInputTypes["order_by"] | undefined | null,
	service_start_date?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	total_amount?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
	website?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: e_governance */
["e_governance_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "e_governance" */
["e_governance_select_column"]:e_governance_select_column;
	/** input type for updating data in table "e_governance" */
["e_governance_set_input"]: {
	address?: string | undefined | null,
	area?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	description?: string | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	phone_no?: string | undefined | null,
	service_end_date?: ResolverInputTypes["date"] | undefined | null,
	service_start_date?: ResolverInputTypes["date"] | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	total_amount?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate stddev on columns */
["e_governance_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "e_governance" */
["e_governance_stddev_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_pop on columns */
["e_governance_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "e_governance" */
["e_governance_stddev_pop_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_samp on columns */
["e_governance_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "e_governance" */
["e_governance_stddev_samp_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Streaming cursor of the table "e_governance" */
["e_governance_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["e_governance_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["e_governance_stream_cursor_value_input"]: {
	address?: string | undefined | null,
	area?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	description?: string | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	phone_no?: string | undefined | null,
	service_end_date?: ResolverInputTypes["date"] | undefined | null,
	service_start_date?: ResolverInputTypes["date"] | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	total_amount?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate sum on columns */
["e_governance_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "e_governance" */
["e_governance_sum_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** update columns of table "e_governance" */
["e_governance_update_column"]:e_governance_update_column;
	["e_governance_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["e_governance_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["e_governance_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["e_governance_bool_exp"]
};
	/** aggregate var_pop on columns */
["e_governance_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "e_governance" */
["e_governance_var_pop_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate var_samp on columns */
["e_governance_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "e_governance" */
["e_governance_var_samp_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate variance on columns */
["e_governance_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "e_governance" */
["e_governance_variance_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** columns and relationships of "faculty" */
["faculty"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_of_joining?:boolean | `@${string}`,
	designation?:boolean | `@${string}`,
	dob?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	experience?:boolean | `@${string}`,
faculty_fundings?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null},ResolverInputTypes["faculty_funding"]],
faculty_fundings_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null},ResolverInputTypes["faculty_funding_aggregate"]],
fdp_pdps?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["fdp_pdp_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["fdp_pdp_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null},ResolverInputTypes["fdp_pdp"]],
fdp_pdps_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["fdp_pdp_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["fdp_pdp_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null},ResolverInputTypes["fdp_pdp_aggregate"]],
	gender?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	/** An object relationship */
	institute?:ResolverInputTypes["institute"],
	institute_id?:boolean | `@${string}`,
	job_type?:boolean | `@${string}`,
	minority?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pan_card_no?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	qualification?:boolean | `@${string}`,
	section?:boolean | `@${string}`,
	staff_type?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	status_of_approval?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "faculty" */
["faculty_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["faculty_aggregate_fields"],
	nodes?:ResolverInputTypes["faculty"],
		__typename?: boolean | `@${string}`
}>;
	["faculty_aggregate_bool_exp"]: {
	count?: ResolverInputTypes["faculty_aggregate_bool_exp_count"] | undefined | null
};
	["faculty_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["faculty_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["faculty_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "faculty" */
["faculty_aggregate_fields"]: AliasType<{
	avg?:ResolverInputTypes["faculty_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["faculty_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["faculty_max_fields"],
	min?:ResolverInputTypes["faculty_min_fields"],
	stddev?:ResolverInputTypes["faculty_stddev_fields"],
	stddev_pop?:ResolverInputTypes["faculty_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["faculty_stddev_samp_fields"],
	sum?:ResolverInputTypes["faculty_sum_fields"],
	var_pop?:ResolverInputTypes["faculty_var_pop_fields"],
	var_samp?:ResolverInputTypes["faculty_var_samp_fields"],
	variance?:ResolverInputTypes["faculty_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "faculty" */
["faculty_aggregate_order_by"]: {
	avg?: ResolverInputTypes["faculty_avg_order_by"] | undefined | null,
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["faculty_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["faculty_min_order_by"] | undefined | null,
	stddev?: ResolverInputTypes["faculty_stddev_order_by"] | undefined | null,
	stddev_pop?: ResolverInputTypes["faculty_stddev_pop_order_by"] | undefined | null,
	stddev_samp?: ResolverInputTypes["faculty_stddev_samp_order_by"] | undefined | null,
	sum?: ResolverInputTypes["faculty_sum_order_by"] | undefined | null,
	var_pop?: ResolverInputTypes["faculty_var_pop_order_by"] | undefined | null,
	var_samp?: ResolverInputTypes["faculty_var_samp_order_by"] | undefined | null,
	variance?: ResolverInputTypes["faculty_variance_order_by"] | undefined | null
};
	/** input type for inserting array relation for remote table "faculty" */
["faculty_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["faculty_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["faculty_on_conflict"] | undefined | null
};
	/** aggregate avg on columns */
["faculty_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "faculty" */
["faculty_avg_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Boolean expression to filter rows from the table "faculty". All fields are combined with a logical 'AND'. */
["faculty_bool_exp"]: {
	_and?: Array<ResolverInputTypes["faculty_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["faculty_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["faculty_bool_exp"]> | undefined | null,
	address?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	cast?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	date_of_joining?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	designation?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	dob?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	email_id?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	experience?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	faculty_fundings?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null,
	faculty_fundings_aggregate?: ResolverInputTypes["faculty_funding_aggregate_bool_exp"] | undefined | null,
	fdp_pdps?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null,
	fdp_pdps_aggregate?: ResolverInputTypes["fdp_pdp_aggregate_bool_exp"] | undefined | null,
	gender?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	institute?: ResolverInputTypes["institute_bool_exp"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	job_type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	minority?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	pan_card_no?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	phone?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	qualification?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	section?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	staff_type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["STATUS_enum_comparison_exp"] | undefined | null,
	status_of_approval?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "faculty" */
["faculty_constraint"]:faculty_constraint;
	/** columns and relationships of "faculty_funding" */
["faculty_funding"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	/** An object relationship */
	faculty?:ResolverInputTypes["faculty"],
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	/** An object relationship */
	institute?:ResolverInputTypes["institute"],
	institute_id?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "faculty_funding" */
["faculty_funding_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["faculty_funding_aggregate_fields"],
	nodes?:ResolverInputTypes["faculty_funding"],
		__typename?: boolean | `@${string}`
}>;
	["faculty_funding_aggregate_bool_exp"]: {
	count?: ResolverInputTypes["faculty_funding_aggregate_bool_exp_count"] | undefined | null
};
	["faculty_funding_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["faculty_funding_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "faculty_funding" */
["faculty_funding_aggregate_fields"]: AliasType<{
	avg?:ResolverInputTypes["faculty_funding_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["faculty_funding_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["faculty_funding_max_fields"],
	min?:ResolverInputTypes["faculty_funding_min_fields"],
	stddev?:ResolverInputTypes["faculty_funding_stddev_fields"],
	stddev_pop?:ResolverInputTypes["faculty_funding_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["faculty_funding_stddev_samp_fields"],
	sum?:ResolverInputTypes["faculty_funding_sum_fields"],
	var_pop?:ResolverInputTypes["faculty_funding_var_pop_fields"],
	var_samp?:ResolverInputTypes["faculty_funding_var_samp_fields"],
	variance?:ResolverInputTypes["faculty_funding_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "faculty_funding" */
["faculty_funding_aggregate_order_by"]: {
	avg?: ResolverInputTypes["faculty_funding_avg_order_by"] | undefined | null,
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["faculty_funding_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["faculty_funding_min_order_by"] | undefined | null,
	stddev?: ResolverInputTypes["faculty_funding_stddev_order_by"] | undefined | null,
	stddev_pop?: ResolverInputTypes["faculty_funding_stddev_pop_order_by"] | undefined | null,
	stddev_samp?: ResolverInputTypes["faculty_funding_stddev_samp_order_by"] | undefined | null,
	sum?: ResolverInputTypes["faculty_funding_sum_order_by"] | undefined | null,
	var_pop?: ResolverInputTypes["faculty_funding_var_pop_order_by"] | undefined | null,
	var_samp?: ResolverInputTypes["faculty_funding_var_samp_order_by"] | undefined | null,
	variance?: ResolverInputTypes["faculty_funding_variance_order_by"] | undefined | null
};
	/** input type for inserting array relation for remote table "faculty_funding" */
["faculty_funding_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["faculty_funding_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["faculty_funding_on_conflict"] | undefined | null
};
	/** aggregate avg on columns */
["faculty_funding_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "faculty_funding" */
["faculty_funding_avg_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Boolean expression to filter rows from the table "faculty_funding". All fields are combined with a logical 'AND'. */
["faculty_funding_bool_exp"]: {
	_and?: Array<ResolverInputTypes["faculty_funding_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["faculty_funding_bool_exp"]> | undefined | null,
	amount?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	faculty?: ResolverInputTypes["faculty_bool_exp"] | undefined | null,
	faculty_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	file?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	institute?: ResolverInputTypes["institute_bool_exp"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	nature?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["STATUS_enum_comparison_exp"] | undefined | null,
	transaction_date?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	transaction_type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "faculty_funding" */
["faculty_funding_constraint"]:faculty_funding_constraint;
	/** input type for incrementing numeric columns in table "faculty_funding" */
["faculty_funding_inc_input"]: {
	cursorId?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "faculty_funding" */
["faculty_funding_insert_input"]: {
	amount?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	faculty?: ResolverInputTypes["faculty_obj_rel_insert_input"] | undefined | null,
	faculty_id?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute?: ResolverInputTypes["institute_obj_rel_insert_input"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	nature?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	transaction_date?: ResolverInputTypes["date"] | undefined | null,
	transaction_type?: string | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["faculty_funding_max_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "faculty_funding" */
["faculty_funding_max_order_by"]: {
	amount?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	faculty_id?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	nature?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_date?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_type?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["faculty_funding_min_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "faculty_funding" */
["faculty_funding_min_order_by"]: {
	amount?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	faculty_id?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	nature?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_date?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_type?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "faculty_funding" */
["faculty_funding_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["faculty_funding"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "faculty_funding" */
["faculty_funding_on_conflict"]: {
	constraint: ResolverInputTypes["faculty_funding_constraint"],
	update_columns: Array<ResolverInputTypes["faculty_funding_update_column"]>,
	where?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "faculty_funding". */
["faculty_funding_order_by"]: {
	amount?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	faculty?: ResolverInputTypes["faculty_order_by"] | undefined | null,
	faculty_id?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute?: ResolverInputTypes["institute_order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	nature?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_date?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_type?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: faculty_funding */
["faculty_funding_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "faculty_funding" */
["faculty_funding_select_column"]:faculty_funding_select_column;
	/** input type for updating data in table "faculty_funding" */
["faculty_funding_set_input"]: {
	amount?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	faculty_id?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	nature?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	transaction_date?: ResolverInputTypes["date"] | undefined | null,
	transaction_type?: string | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate stddev on columns */
["faculty_funding_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "faculty_funding" */
["faculty_funding_stddev_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_pop on columns */
["faculty_funding_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "faculty_funding" */
["faculty_funding_stddev_pop_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_samp on columns */
["faculty_funding_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "faculty_funding" */
["faculty_funding_stddev_samp_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Streaming cursor of the table "faculty_funding" */
["faculty_funding_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["faculty_funding_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["faculty_funding_stream_cursor_value_input"]: {
	amount?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	faculty_id?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	nature?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	transaction_date?: ResolverInputTypes["date"] | undefined | null,
	transaction_type?: string | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate sum on columns */
["faculty_funding_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "faculty_funding" */
["faculty_funding_sum_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** update columns of table "faculty_funding" */
["faculty_funding_update_column"]:faculty_funding_update_column;
	["faculty_funding_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["faculty_funding_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["faculty_funding_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["faculty_funding_bool_exp"]
};
	/** aggregate var_pop on columns */
["faculty_funding_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "faculty_funding" */
["faculty_funding_var_pop_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate var_samp on columns */
["faculty_funding_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "faculty_funding" */
["faculty_funding_var_samp_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate variance on columns */
["faculty_funding_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "faculty_funding" */
["faculty_funding_variance_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** input type for incrementing numeric columns in table "faculty" */
["faculty_inc_input"]: {
	cursorId?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "faculty" */
["faculty_insert_input"]: {
	address?: string | undefined | null,
	cast?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	date_of_joining?: ResolverInputTypes["date"] | undefined | null,
	designation?: string | undefined | null,
	dob?: ResolverInputTypes["date"] | undefined | null,
	email_id?: string | undefined | null,
	experience?: string | undefined | null,
	faculty_fundings?: ResolverInputTypes["faculty_funding_arr_rel_insert_input"] | undefined | null,
	fdp_pdps?: ResolverInputTypes["fdp_pdp_arr_rel_insert_input"] | undefined | null,
	gender?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute?: ResolverInputTypes["institute_obj_rel_insert_input"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	job_type?: string | undefined | null,
	minority?: string | undefined | null,
	name?: string | undefined | null,
	pan_card_no?: string | undefined | null,
	phone?: string | undefined | null,
	qualification?: string | undefined | null,
	section?: string | undefined | null,
	staff_type?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	status_of_approval?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["faculty_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_of_joining?:boolean | `@${string}`,
	designation?:boolean | `@${string}`,
	dob?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	experience?:boolean | `@${string}`,
	gender?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	job_type?:boolean | `@${string}`,
	minority?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pan_card_no?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	qualification?:boolean | `@${string}`,
	section?:boolean | `@${string}`,
	staff_type?:boolean | `@${string}`,
	status_of_approval?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "faculty" */
["faculty_max_order_by"]: {
	address?: ResolverInputTypes["order_by"] | undefined | null,
	cast?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	date_of_joining?: ResolverInputTypes["order_by"] | undefined | null,
	designation?: ResolverInputTypes["order_by"] | undefined | null,
	dob?: ResolverInputTypes["order_by"] | undefined | null,
	email_id?: ResolverInputTypes["order_by"] | undefined | null,
	experience?: ResolverInputTypes["order_by"] | undefined | null,
	gender?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	job_type?: ResolverInputTypes["order_by"] | undefined | null,
	minority?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	pan_card_no?: ResolverInputTypes["order_by"] | undefined | null,
	phone?: ResolverInputTypes["order_by"] | undefined | null,
	qualification?: ResolverInputTypes["order_by"] | undefined | null,
	section?: ResolverInputTypes["order_by"] | undefined | null,
	staff_type?: ResolverInputTypes["order_by"] | undefined | null,
	status_of_approval?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["faculty_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_of_joining?:boolean | `@${string}`,
	designation?:boolean | `@${string}`,
	dob?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	experience?:boolean | `@${string}`,
	gender?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	job_type?:boolean | `@${string}`,
	minority?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pan_card_no?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	qualification?:boolean | `@${string}`,
	section?:boolean | `@${string}`,
	staff_type?:boolean | `@${string}`,
	status_of_approval?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "faculty" */
["faculty_min_order_by"]: {
	address?: ResolverInputTypes["order_by"] | undefined | null,
	cast?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	date_of_joining?: ResolverInputTypes["order_by"] | undefined | null,
	designation?: ResolverInputTypes["order_by"] | undefined | null,
	dob?: ResolverInputTypes["order_by"] | undefined | null,
	email_id?: ResolverInputTypes["order_by"] | undefined | null,
	experience?: ResolverInputTypes["order_by"] | undefined | null,
	gender?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	job_type?: ResolverInputTypes["order_by"] | undefined | null,
	minority?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	pan_card_no?: ResolverInputTypes["order_by"] | undefined | null,
	phone?: ResolverInputTypes["order_by"] | undefined | null,
	qualification?: ResolverInputTypes["order_by"] | undefined | null,
	section?: ResolverInputTypes["order_by"] | undefined | null,
	staff_type?: ResolverInputTypes["order_by"] | undefined | null,
	status_of_approval?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "faculty" */
["faculty_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["faculty"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "faculty" */
["faculty_obj_rel_insert_input"]: {
	data: ResolverInputTypes["faculty_insert_input"],
	/** upsert condition */
	on_conflict?: ResolverInputTypes["faculty_on_conflict"] | undefined | null
};
	/** on_conflict condition type for table "faculty" */
["faculty_on_conflict"]: {
	constraint: ResolverInputTypes["faculty_constraint"],
	update_columns: Array<ResolverInputTypes["faculty_update_column"]>,
	where?: ResolverInputTypes["faculty_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "faculty". */
["faculty_order_by"]: {
	address?: ResolverInputTypes["order_by"] | undefined | null,
	cast?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	date_of_joining?: ResolverInputTypes["order_by"] | undefined | null,
	designation?: ResolverInputTypes["order_by"] | undefined | null,
	dob?: ResolverInputTypes["order_by"] | undefined | null,
	email_id?: ResolverInputTypes["order_by"] | undefined | null,
	experience?: ResolverInputTypes["order_by"] | undefined | null,
	faculty_fundings_aggregate?: ResolverInputTypes["faculty_funding_aggregate_order_by"] | undefined | null,
	fdp_pdps_aggregate?: ResolverInputTypes["fdp_pdp_aggregate_order_by"] | undefined | null,
	gender?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute?: ResolverInputTypes["institute_order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	job_type?: ResolverInputTypes["order_by"] | undefined | null,
	minority?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	pan_card_no?: ResolverInputTypes["order_by"] | undefined | null,
	phone?: ResolverInputTypes["order_by"] | undefined | null,
	qualification?: ResolverInputTypes["order_by"] | undefined | null,
	section?: ResolverInputTypes["order_by"] | undefined | null,
	staff_type?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	status_of_approval?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: faculty */
["faculty_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "faculty" */
["faculty_select_column"]:faculty_select_column;
	/** input type for updating data in table "faculty" */
["faculty_set_input"]: {
	address?: string | undefined | null,
	cast?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	date_of_joining?: ResolverInputTypes["date"] | undefined | null,
	designation?: string | undefined | null,
	dob?: ResolverInputTypes["date"] | undefined | null,
	email_id?: string | undefined | null,
	experience?: string | undefined | null,
	gender?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	job_type?: string | undefined | null,
	minority?: string | undefined | null,
	name?: string | undefined | null,
	pan_card_no?: string | undefined | null,
	phone?: string | undefined | null,
	qualification?: string | undefined | null,
	section?: string | undefined | null,
	staff_type?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	status_of_approval?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate stddev on columns */
["faculty_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "faculty" */
["faculty_stddev_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_pop on columns */
["faculty_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "faculty" */
["faculty_stddev_pop_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_samp on columns */
["faculty_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "faculty" */
["faculty_stddev_samp_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Streaming cursor of the table "faculty" */
["faculty_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["faculty_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["faculty_stream_cursor_value_input"]: {
	address?: string | undefined | null,
	cast?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	date_of_joining?: ResolverInputTypes["date"] | undefined | null,
	designation?: string | undefined | null,
	dob?: ResolverInputTypes["date"] | undefined | null,
	email_id?: string | undefined | null,
	experience?: string | undefined | null,
	gender?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	job_type?: string | undefined | null,
	minority?: string | undefined | null,
	name?: string | undefined | null,
	pan_card_no?: string | undefined | null,
	phone?: string | undefined | null,
	qualification?: string | undefined | null,
	section?: string | undefined | null,
	staff_type?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	status_of_approval?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate sum on columns */
["faculty_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "faculty" */
["faculty_sum_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** update columns of table "faculty" */
["faculty_update_column"]:faculty_update_column;
	["faculty_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["faculty_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["faculty_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["faculty_bool_exp"]
};
	/** aggregate var_pop on columns */
["faculty_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "faculty" */
["faculty_var_pop_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate var_samp on columns */
["faculty_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "faculty" */
["faculty_var_samp_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate variance on columns */
["faculty_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "faculty" */
["faculty_variance_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** columns and relationships of "fdp_pdp" */
["fdp_pdp"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_from?:boolean | `@${string}`,
	date_to?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	/** An object relationship */
	faculty?:ResolverInputTypes["faculty"],
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	/** An object relationship */
	institute?:ResolverInputTypes["institute"],
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "fdp_pdp" */
["fdp_pdp_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["fdp_pdp_aggregate_fields"],
	nodes?:ResolverInputTypes["fdp_pdp"],
		__typename?: boolean | `@${string}`
}>;
	["fdp_pdp_aggregate_bool_exp"]: {
	count?: ResolverInputTypes["fdp_pdp_aggregate_bool_exp_count"] | undefined | null
};
	["fdp_pdp_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["fdp_pdp_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "fdp_pdp" */
["fdp_pdp_aggregate_fields"]: AliasType<{
	avg?:ResolverInputTypes["fdp_pdp_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["fdp_pdp_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["fdp_pdp_max_fields"],
	min?:ResolverInputTypes["fdp_pdp_min_fields"],
	stddev?:ResolverInputTypes["fdp_pdp_stddev_fields"],
	stddev_pop?:ResolverInputTypes["fdp_pdp_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["fdp_pdp_stddev_samp_fields"],
	sum?:ResolverInputTypes["fdp_pdp_sum_fields"],
	var_pop?:ResolverInputTypes["fdp_pdp_var_pop_fields"],
	var_samp?:ResolverInputTypes["fdp_pdp_var_samp_fields"],
	variance?:ResolverInputTypes["fdp_pdp_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "fdp_pdp" */
["fdp_pdp_aggregate_order_by"]: {
	avg?: ResolverInputTypes["fdp_pdp_avg_order_by"] | undefined | null,
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["fdp_pdp_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["fdp_pdp_min_order_by"] | undefined | null,
	stddev?: ResolverInputTypes["fdp_pdp_stddev_order_by"] | undefined | null,
	stddev_pop?: ResolverInputTypes["fdp_pdp_stddev_pop_order_by"] | undefined | null,
	stddev_samp?: ResolverInputTypes["fdp_pdp_stddev_samp_order_by"] | undefined | null,
	sum?: ResolverInputTypes["fdp_pdp_sum_order_by"] | undefined | null,
	var_pop?: ResolverInputTypes["fdp_pdp_var_pop_order_by"] | undefined | null,
	var_samp?: ResolverInputTypes["fdp_pdp_var_samp_order_by"] | undefined | null,
	variance?: ResolverInputTypes["fdp_pdp_variance_order_by"] | undefined | null
};
	/** input type for inserting array relation for remote table "fdp_pdp" */
["fdp_pdp_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["fdp_pdp_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["fdp_pdp_on_conflict"] | undefined | null
};
	/** aggregate avg on columns */
["fdp_pdp_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "fdp_pdp" */
["fdp_pdp_avg_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Boolean expression to filter rows from the table "fdp_pdp". All fields are combined with a logical 'AND'. */
["fdp_pdp_bool_exp"]: {
	_and?: Array<ResolverInputTypes["fdp_pdp_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["fdp_pdp_bool_exp"]> | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	date_from?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	date_to?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	description?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	faculty?: ResolverInputTypes["faculty_bool_exp"] | undefined | null,
	faculty_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	file?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	institute?: ResolverInputTypes["institute_bool_exp"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	nature?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["STATUS_enum_comparison_exp"] | undefined | null,
	type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	venue?: ResolverInputTypes["String_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "fdp_pdp" */
["fdp_pdp_constraint"]:fdp_pdp_constraint;
	/** input type for incrementing numeric columns in table "fdp_pdp" */
["fdp_pdp_inc_input"]: {
	cursorId?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "fdp_pdp" */
["fdp_pdp_insert_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	date_from?: ResolverInputTypes["date"] | undefined | null,
	date_to?: ResolverInputTypes["date"] | undefined | null,
	description?: string | undefined | null,
	faculty?: ResolverInputTypes["faculty_obj_rel_insert_input"] | undefined | null,
	faculty_id?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute?: ResolverInputTypes["institute_obj_rel_insert_input"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	nature?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	venue?: string | undefined | null
};
	/** aggregate max on columns */
["fdp_pdp_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_from?:boolean | `@${string}`,
	date_to?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "fdp_pdp" */
["fdp_pdp_max_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	date_from?: ResolverInputTypes["order_by"] | undefined | null,
	date_to?: ResolverInputTypes["order_by"] | undefined | null,
	description?: ResolverInputTypes["order_by"] | undefined | null,
	faculty_id?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	nature?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
	venue?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["fdp_pdp_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_from?:boolean | `@${string}`,
	date_to?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "fdp_pdp" */
["fdp_pdp_min_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	date_from?: ResolverInputTypes["order_by"] | undefined | null,
	date_to?: ResolverInputTypes["order_by"] | undefined | null,
	description?: ResolverInputTypes["order_by"] | undefined | null,
	faculty_id?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	nature?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
	venue?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "fdp_pdp" */
["fdp_pdp_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["fdp_pdp"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "fdp_pdp" */
["fdp_pdp_on_conflict"]: {
	constraint: ResolverInputTypes["fdp_pdp_constraint"],
	update_columns: Array<ResolverInputTypes["fdp_pdp_update_column"]>,
	where?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "fdp_pdp". */
["fdp_pdp_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	date_from?: ResolverInputTypes["order_by"] | undefined | null,
	date_to?: ResolverInputTypes["order_by"] | undefined | null,
	description?: ResolverInputTypes["order_by"] | undefined | null,
	faculty?: ResolverInputTypes["faculty_order_by"] | undefined | null,
	faculty_id?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute?: ResolverInputTypes["institute_order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	nature?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
	venue?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: fdp_pdp */
["fdp_pdp_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "fdp_pdp" */
["fdp_pdp_select_column"]:fdp_pdp_select_column;
	/** input type for updating data in table "fdp_pdp" */
["fdp_pdp_set_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	date_from?: ResolverInputTypes["date"] | undefined | null,
	date_to?: ResolverInputTypes["date"] | undefined | null,
	description?: string | undefined | null,
	faculty_id?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	nature?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	venue?: string | undefined | null
};
	/** aggregate stddev on columns */
["fdp_pdp_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "fdp_pdp" */
["fdp_pdp_stddev_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_pop on columns */
["fdp_pdp_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "fdp_pdp" */
["fdp_pdp_stddev_pop_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_samp on columns */
["fdp_pdp_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "fdp_pdp" */
["fdp_pdp_stddev_samp_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Streaming cursor of the table "fdp_pdp" */
["fdp_pdp_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["fdp_pdp_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["fdp_pdp_stream_cursor_value_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	date_from?: ResolverInputTypes["date"] | undefined | null,
	date_to?: ResolverInputTypes["date"] | undefined | null,
	description?: string | undefined | null,
	faculty_id?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	nature?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	venue?: string | undefined | null
};
	/** aggregate sum on columns */
["fdp_pdp_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "fdp_pdp" */
["fdp_pdp_sum_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** update columns of table "fdp_pdp" */
["fdp_pdp_update_column"]:fdp_pdp_update_column;
	["fdp_pdp_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["fdp_pdp_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["fdp_pdp_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["fdp_pdp_bool_exp"]
};
	/** aggregate var_pop on columns */
["fdp_pdp_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "fdp_pdp" */
["fdp_pdp_var_pop_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate var_samp on columns */
["fdp_pdp_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "fdp_pdp" */
["fdp_pdp_var_samp_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate variance on columns */
["fdp_pdp_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "fdp_pdp" */
["fdp_pdp_variance_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** columns and relationships of "genesis" */
["genesis"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isVerified?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "genesis" */
["genesis_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["genesis_aggregate_fields"],
	nodes?:ResolverInputTypes["genesis"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "genesis" */
["genesis_aggregate_fields"]: AliasType<{
	avg?:ResolverInputTypes["genesis_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["genesis_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["genesis_max_fields"],
	min?:ResolverInputTypes["genesis_min_fields"],
	stddev?:ResolverInputTypes["genesis_stddev_fields"],
	stddev_pop?:ResolverInputTypes["genesis_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["genesis_stddev_samp_fields"],
	sum?:ResolverInputTypes["genesis_sum_fields"],
	var_pop?:ResolverInputTypes["genesis_var_pop_fields"],
	var_samp?:ResolverInputTypes["genesis_var_samp_fields"],
	variance?:ResolverInputTypes["genesis_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["genesis_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "genesis". All fields are combined with a logical 'AND'. */
["genesis_bool_exp"]: {
	_and?: Array<ResolverInputTypes["genesis_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["genesis_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["genesis_bool_exp"]> | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	email_id?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	isVerified?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	phone?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	role?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["STATUS_enum_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "genesis" */
["genesis_constraint"]:genesis_constraint;
	/** input type for incrementing numeric columns in table "genesis" */
["genesis_inc_input"]: {
	cursorId?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "genesis" */
["genesis_insert_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	email_id?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isVerified?: string | undefined | null,
	name?: string | undefined | null,
	phone?: string | undefined | null,
	role?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["genesis_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isVerified?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["genesis_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isVerified?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "genesis" */
["genesis_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["genesis"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "genesis" */
["genesis_on_conflict"]: {
	constraint: ResolverInputTypes["genesis_constraint"],
	update_columns: Array<ResolverInputTypes["genesis_update_column"]>,
	where?: ResolverInputTypes["genesis_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "genesis". */
["genesis_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	email_id?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	isVerified?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	phone?: ResolverInputTypes["order_by"] | undefined | null,
	role?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: genesis */
["genesis_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "genesis" */
["genesis_select_column"]:genesis_select_column;
	/** input type for updating data in table "genesis" */
["genesis_set_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	email_id?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isVerified?: string | undefined | null,
	name?: string | undefined | null,
	phone?: string | undefined | null,
	role?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate stddev on columns */
["genesis_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["genesis_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["genesis_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Streaming cursor of the table "genesis" */
["genesis_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["genesis_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["genesis_stream_cursor_value_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	email_id?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isVerified?: string | undefined | null,
	name?: string | undefined | null,
	phone?: string | undefined | null,
	role?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate sum on columns */
["genesis_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "genesis" */
["genesis_update_column"]:genesis_update_column;
	["genesis_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["genesis_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["genesis_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["genesis_bool_exp"]
};
	/** aggregate var_pop on columns */
["genesis_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["genesis_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["genesis_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "institute" */
["institute"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_of_establishment?:boolean | `@${string}`,
e_governances?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["e_governance_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["e_governance_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["e_governance_bool_exp"] | undefined | null},ResolverInputTypes["e_governance"]],
e_governances_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["e_governance_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["e_governance_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["e_governance_bool_exp"] | undefined | null},ResolverInputTypes["e_governance_aggregate"]],
faculties?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_bool_exp"] | undefined | null},ResolverInputTypes["faculty"]],
faculties_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_bool_exp"] | undefined | null},ResolverInputTypes["faculty_aggregate"]],
faculty_fundings?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null},ResolverInputTypes["faculty_funding"]],
faculty_fundings_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null},ResolverInputTypes["faculty_funding_aggregate"]],
fdp_pdps?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["fdp_pdp_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["fdp_pdp_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null},ResolverInputTypes["fdp_pdp"]],
fdp_pdps_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["fdp_pdp_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["fdp_pdp_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null},ResolverInputTypes["fdp_pdp_aggregate"]],
	id?:boolean | `@${string}`,
institute_fundings?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["institute_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["institute_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["institute_funding_bool_exp"] | undefined | null},ResolverInputTypes["institute_funding"]],
institute_fundings_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["institute_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["institute_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["institute_funding_bool_exp"] | undefined | null},ResolverInputTypes["institute_funding_aggregate"]],
	landmark?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pin?:boolean | `@${string}`,
	state?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "institute" */
["institute_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["institute_aggregate_fields"],
	nodes?:ResolverInputTypes["institute"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "institute" */
["institute_aggregate_fields"]: AliasType<{
	avg?:ResolverInputTypes["institute_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["institute_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["institute_max_fields"],
	min?:ResolverInputTypes["institute_min_fields"],
	stddev?:ResolverInputTypes["institute_stddev_fields"],
	stddev_pop?:ResolverInputTypes["institute_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["institute_stddev_samp_fields"],
	sum?:ResolverInputTypes["institute_sum_fields"],
	var_pop?:ResolverInputTypes["institute_var_pop_fields"],
	var_samp?:ResolverInputTypes["institute_var_samp_fields"],
	variance?:ResolverInputTypes["institute_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["institute_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "institute". All fields are combined with a logical 'AND'. */
["institute_bool_exp"]: {
	_and?: Array<ResolverInputTypes["institute_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["institute_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["institute_bool_exp"]> | undefined | null,
	address?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	city?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	date_of_establishment?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	e_governances?: ResolverInputTypes["e_governance_bool_exp"] | undefined | null,
	e_governances_aggregate?: ResolverInputTypes["e_governance_aggregate_bool_exp"] | undefined | null,
	faculties?: ResolverInputTypes["faculty_bool_exp"] | undefined | null,
	faculties_aggregate?: ResolverInputTypes["faculty_aggregate_bool_exp"] | undefined | null,
	faculty_fundings?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null,
	faculty_fundings_aggregate?: ResolverInputTypes["faculty_funding_aggregate_bool_exp"] | undefined | null,
	fdp_pdps?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null,
	fdp_pdps_aggregate?: ResolverInputTypes["fdp_pdp_aggregate_bool_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	institute_fundings?: ResolverInputTypes["institute_funding_bool_exp"] | undefined | null,
	institute_fundings_aggregate?: ResolverInputTypes["institute_funding_aggregate_bool_exp"] | undefined | null,
	landmark?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	pin?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	state?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["STATUS_enum_comparison_exp"] | undefined | null,
	type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	website?: ResolverInputTypes["String_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "institute" */
["institute_constraint"]:institute_constraint;
	/** columns and relationships of "institute_funding" */
["institute_funding"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	/** An object relationship */
	institute?:ResolverInputTypes["institute"],
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "institute_funding" */
["institute_funding_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["institute_funding_aggregate_fields"],
	nodes?:ResolverInputTypes["institute_funding"],
		__typename?: boolean | `@${string}`
}>;
	["institute_funding_aggregate_bool_exp"]: {
	count?: ResolverInputTypes["institute_funding_aggregate_bool_exp_count"] | undefined | null
};
	["institute_funding_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["institute_funding_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["institute_funding_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "institute_funding" */
["institute_funding_aggregate_fields"]: AliasType<{
	avg?:ResolverInputTypes["institute_funding_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["institute_funding_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["institute_funding_max_fields"],
	min?:ResolverInputTypes["institute_funding_min_fields"],
	stddev?:ResolverInputTypes["institute_funding_stddev_fields"],
	stddev_pop?:ResolverInputTypes["institute_funding_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["institute_funding_stddev_samp_fields"],
	sum?:ResolverInputTypes["institute_funding_sum_fields"],
	var_pop?:ResolverInputTypes["institute_funding_var_pop_fields"],
	var_samp?:ResolverInputTypes["institute_funding_var_samp_fields"],
	variance?:ResolverInputTypes["institute_funding_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "institute_funding" */
["institute_funding_aggregate_order_by"]: {
	avg?: ResolverInputTypes["institute_funding_avg_order_by"] | undefined | null,
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["institute_funding_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["institute_funding_min_order_by"] | undefined | null,
	stddev?: ResolverInputTypes["institute_funding_stddev_order_by"] | undefined | null,
	stddev_pop?: ResolverInputTypes["institute_funding_stddev_pop_order_by"] | undefined | null,
	stddev_samp?: ResolverInputTypes["institute_funding_stddev_samp_order_by"] | undefined | null,
	sum?: ResolverInputTypes["institute_funding_sum_order_by"] | undefined | null,
	var_pop?: ResolverInputTypes["institute_funding_var_pop_order_by"] | undefined | null,
	var_samp?: ResolverInputTypes["institute_funding_var_samp_order_by"] | undefined | null,
	variance?: ResolverInputTypes["institute_funding_variance_order_by"] | undefined | null
};
	/** input type for inserting array relation for remote table "institute_funding" */
["institute_funding_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["institute_funding_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["institute_funding_on_conflict"] | undefined | null
};
	/** aggregate avg on columns */
["institute_funding_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "institute_funding" */
["institute_funding_avg_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Boolean expression to filter rows from the table "institute_funding". All fields are combined with a logical 'AND'. */
["institute_funding_bool_exp"]: {
	_and?: Array<ResolverInputTypes["institute_funding_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["institute_funding_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["institute_funding_bool_exp"]> | undefined | null,
	amount?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	institute?: ResolverInputTypes["institute_bool_exp"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	purpose?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["STATUS_enum_comparison_exp"] | undefined | null,
	transaction_date?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	transaction_type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "institute_funding" */
["institute_funding_constraint"]:institute_funding_constraint;
	/** input type for incrementing numeric columns in table "institute_funding" */
["institute_funding_inc_input"]: {
	cursorId?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "institute_funding" */
["institute_funding_insert_input"]: {
	amount?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute?: ResolverInputTypes["institute_obj_rel_insert_input"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	purpose?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	transaction_date?: ResolverInputTypes["date"] | undefined | null,
	transaction_type?: string | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["institute_funding_max_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "institute_funding" */
["institute_funding_max_order_by"]: {
	amount?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	purpose?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_date?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_type?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["institute_funding_min_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "institute_funding" */
["institute_funding_min_order_by"]: {
	amount?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	purpose?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_date?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_type?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "institute_funding" */
["institute_funding_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["institute_funding"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "institute_funding" */
["institute_funding_on_conflict"]: {
	constraint: ResolverInputTypes["institute_funding_constraint"],
	update_columns: Array<ResolverInputTypes["institute_funding_update_column"]>,
	where?: ResolverInputTypes["institute_funding_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "institute_funding". */
["institute_funding_order_by"]: {
	amount?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute?: ResolverInputTypes["institute_order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	purpose?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_date?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_type?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: institute_funding */
["institute_funding_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "institute_funding" */
["institute_funding_select_column"]:institute_funding_select_column;
	/** input type for updating data in table "institute_funding" */
["institute_funding_set_input"]: {
	amount?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	purpose?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	transaction_date?: ResolverInputTypes["date"] | undefined | null,
	transaction_type?: string | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate stddev on columns */
["institute_funding_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "institute_funding" */
["institute_funding_stddev_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_pop on columns */
["institute_funding_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "institute_funding" */
["institute_funding_stddev_pop_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_samp on columns */
["institute_funding_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "institute_funding" */
["institute_funding_stddev_samp_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Streaming cursor of the table "institute_funding" */
["institute_funding_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["institute_funding_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["institute_funding_stream_cursor_value_input"]: {
	amount?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	purpose?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	transaction_date?: ResolverInputTypes["date"] | undefined | null,
	transaction_type?: string | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate sum on columns */
["institute_funding_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "institute_funding" */
["institute_funding_sum_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** update columns of table "institute_funding" */
["institute_funding_update_column"]:institute_funding_update_column;
	["institute_funding_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["institute_funding_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["institute_funding_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["institute_funding_bool_exp"]
};
	/** aggregate var_pop on columns */
["institute_funding_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "institute_funding" */
["institute_funding_var_pop_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate var_samp on columns */
["institute_funding_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "institute_funding" */
["institute_funding_var_samp_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate variance on columns */
["institute_funding_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "institute_funding" */
["institute_funding_variance_order_by"]: {
	cursorId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** input type for incrementing numeric columns in table "institute" */
["institute_inc_input"]: {
	cursorId?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "institute" */
["institute_insert_input"]: {
	address?: string | undefined | null,
	city?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	date_of_establishment?: ResolverInputTypes["date"] | undefined | null,
	e_governances?: ResolverInputTypes["e_governance_arr_rel_insert_input"] | undefined | null,
	faculties?: ResolverInputTypes["faculty_arr_rel_insert_input"] | undefined | null,
	faculty_fundings?: ResolverInputTypes["faculty_funding_arr_rel_insert_input"] | undefined | null,
	fdp_pdps?: ResolverInputTypes["fdp_pdp_arr_rel_insert_input"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_fundings?: ResolverInputTypes["institute_funding_arr_rel_insert_input"] | undefined | null,
	landmark?: string | undefined | null,
	name?: string | undefined | null,
	pin?: string | undefined | null,
	state?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate max on columns */
["institute_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_of_establishment?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	landmark?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pin?:boolean | `@${string}`,
	state?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["institute_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	date_of_establishment?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	landmark?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pin?:boolean | `@${string}`,
	state?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "institute" */
["institute_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["institute"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "institute" */
["institute_obj_rel_insert_input"]: {
	data: ResolverInputTypes["institute_insert_input"],
	/** upsert condition */
	on_conflict?: ResolverInputTypes["institute_on_conflict"] | undefined | null
};
	/** on_conflict condition type for table "institute" */
["institute_on_conflict"]: {
	constraint: ResolverInputTypes["institute_constraint"],
	update_columns: Array<ResolverInputTypes["institute_update_column"]>,
	where?: ResolverInputTypes["institute_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "institute". */
["institute_order_by"]: {
	address?: ResolverInputTypes["order_by"] | undefined | null,
	city?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	date_of_establishment?: ResolverInputTypes["order_by"] | undefined | null,
	e_governances_aggregate?: ResolverInputTypes["e_governance_aggregate_order_by"] | undefined | null,
	faculties_aggregate?: ResolverInputTypes["faculty_aggregate_order_by"] | undefined | null,
	faculty_fundings_aggregate?: ResolverInputTypes["faculty_funding_aggregate_order_by"] | undefined | null,
	fdp_pdps_aggregate?: ResolverInputTypes["fdp_pdp_aggregate_order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_fundings_aggregate?: ResolverInputTypes["institute_funding_aggregate_order_by"] | undefined | null,
	landmark?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	pin?: ResolverInputTypes["order_by"] | undefined | null,
	state?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
	website?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: institute */
["institute_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "institute" */
["institute_select_column"]:institute_select_column;
	/** input type for updating data in table "institute" */
["institute_set_input"]: {
	address?: string | undefined | null,
	city?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	date_of_establishment?: ResolverInputTypes["date"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	landmark?: string | undefined | null,
	name?: string | undefined | null,
	pin?: string | undefined | null,
	state?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate stddev on columns */
["institute_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["institute_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["institute_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Streaming cursor of the table "institute" */
["institute_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["institute_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["institute_stream_cursor_value_input"]: {
	address?: string | undefined | null,
	city?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	date_of_establishment?: ResolverInputTypes["date"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	landmark?: string | undefined | null,
	name?: string | undefined | null,
	pin?: string | undefined | null,
	state?: string | undefined | null,
	status?: ResolverInputTypes["STATUS_enum"] | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate sum on columns */
["institute_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "institute" */
["institute_update_column"]:institute_update_column;
	["institute_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["institute_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["institute_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["institute_bool_exp"]
};
	/** aggregate var_pop on columns */
["institute_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["institute_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["institute_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** mutation root */
["mutation_root"]: AliasType<{
delete_STATUS?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["STATUS_bool_exp"]},ResolverInputTypes["STATUS_mutation_response"]],
delete_STATUS_by_pk?: [{	value: string},ResolverInputTypes["STATUS"]],
delete_e_governance?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["e_governance_bool_exp"]},ResolverInputTypes["e_governance_mutation_response"]],
delete_e_governance_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["e_governance"]],
delete_faculty?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["faculty_bool_exp"]},ResolverInputTypes["faculty_mutation_response"]],
delete_faculty_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["faculty"]],
delete_faculty_funding?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["faculty_funding_bool_exp"]},ResolverInputTypes["faculty_funding_mutation_response"]],
delete_faculty_funding_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["faculty_funding"]],
delete_fdp_pdp?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["fdp_pdp_bool_exp"]},ResolverInputTypes["fdp_pdp_mutation_response"]],
delete_fdp_pdp_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["fdp_pdp"]],
delete_genesis?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["genesis_bool_exp"]},ResolverInputTypes["genesis_mutation_response"]],
delete_genesis_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["genesis"]],
delete_institute?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["institute_bool_exp"]},ResolverInputTypes["institute_mutation_response"]],
delete_institute_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["institute"]],
delete_institute_funding?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["institute_funding_bool_exp"]},ResolverInputTypes["institute_funding_mutation_response"]],
delete_institute_funding_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["institute_funding"]],
insert_STATUS?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["STATUS_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["STATUS_on_conflict"] | undefined | null},ResolverInputTypes["STATUS_mutation_response"]],
insert_STATUS_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["STATUS_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["STATUS_on_conflict"] | undefined | null},ResolverInputTypes["STATUS"]],
insert_e_governance?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["e_governance_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["e_governance_on_conflict"] | undefined | null},ResolverInputTypes["e_governance_mutation_response"]],
insert_e_governance_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["e_governance_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["e_governance_on_conflict"] | undefined | null},ResolverInputTypes["e_governance"]],
insert_faculty?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["faculty_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["faculty_on_conflict"] | undefined | null},ResolverInputTypes["faculty_mutation_response"]],
insert_faculty_funding?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["faculty_funding_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["faculty_funding_on_conflict"] | undefined | null},ResolverInputTypes["faculty_funding_mutation_response"]],
insert_faculty_funding_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["faculty_funding_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["faculty_funding_on_conflict"] | undefined | null},ResolverInputTypes["faculty_funding"]],
insert_faculty_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["faculty_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["faculty_on_conflict"] | undefined | null},ResolverInputTypes["faculty"]],
insert_fdp_pdp?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["fdp_pdp_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["fdp_pdp_on_conflict"] | undefined | null},ResolverInputTypes["fdp_pdp_mutation_response"]],
insert_fdp_pdp_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["fdp_pdp_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["fdp_pdp_on_conflict"] | undefined | null},ResolverInputTypes["fdp_pdp"]],
insert_genesis?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["genesis_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["genesis_on_conflict"] | undefined | null},ResolverInputTypes["genesis_mutation_response"]],
insert_genesis_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["genesis_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["genesis_on_conflict"] | undefined | null},ResolverInputTypes["genesis"]],
insert_institute?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["institute_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["institute_on_conflict"] | undefined | null},ResolverInputTypes["institute_mutation_response"]],
insert_institute_funding?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["institute_funding_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["institute_funding_on_conflict"] | undefined | null},ResolverInputTypes["institute_funding_mutation_response"]],
insert_institute_funding_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["institute_funding_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["institute_funding_on_conflict"] | undefined | null},ResolverInputTypes["institute_funding"]],
insert_institute_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["institute_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["institute_on_conflict"] | undefined | null},ResolverInputTypes["institute"]],
update_STATUS?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["STATUS_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["STATUS_bool_exp"]},ResolverInputTypes["STATUS_mutation_response"]],
update_STATUS_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["STATUS_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["STATUS_pk_columns_input"]},ResolverInputTypes["STATUS"]],
update_STATUS_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["STATUS_updates"]>},ResolverInputTypes["STATUS_mutation_response"]],
update_e_governance?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["e_governance_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["e_governance_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["e_governance_bool_exp"]},ResolverInputTypes["e_governance_mutation_response"]],
update_e_governance_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["e_governance_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["e_governance_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["e_governance_pk_columns_input"]},ResolverInputTypes["e_governance"]],
update_e_governance_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["e_governance_updates"]>},ResolverInputTypes["e_governance_mutation_response"]],
update_faculty?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["faculty_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["faculty_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["faculty_bool_exp"]},ResolverInputTypes["faculty_mutation_response"]],
update_faculty_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["faculty_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["faculty_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["faculty_pk_columns_input"]},ResolverInputTypes["faculty"]],
update_faculty_funding?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["faculty_funding_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["faculty_funding_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["faculty_funding_bool_exp"]},ResolverInputTypes["faculty_funding_mutation_response"]],
update_faculty_funding_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["faculty_funding_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["faculty_funding_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["faculty_funding_pk_columns_input"]},ResolverInputTypes["faculty_funding"]],
update_faculty_funding_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["faculty_funding_updates"]>},ResolverInputTypes["faculty_funding_mutation_response"]],
update_faculty_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["faculty_updates"]>},ResolverInputTypes["faculty_mutation_response"]],
update_fdp_pdp?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["fdp_pdp_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["fdp_pdp_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["fdp_pdp_bool_exp"]},ResolverInputTypes["fdp_pdp_mutation_response"]],
update_fdp_pdp_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["fdp_pdp_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["fdp_pdp_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["fdp_pdp_pk_columns_input"]},ResolverInputTypes["fdp_pdp"]],
update_fdp_pdp_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["fdp_pdp_updates"]>},ResolverInputTypes["fdp_pdp_mutation_response"]],
update_genesis?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["genesis_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["genesis_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["genesis_bool_exp"]},ResolverInputTypes["genesis_mutation_response"]],
update_genesis_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["genesis_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["genesis_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["genesis_pk_columns_input"]},ResolverInputTypes["genesis"]],
update_genesis_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["genesis_updates"]>},ResolverInputTypes["genesis_mutation_response"]],
update_institute?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["institute_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["institute_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["institute_bool_exp"]},ResolverInputTypes["institute_mutation_response"]],
update_institute_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["institute_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["institute_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["institute_pk_columns_input"]},ResolverInputTypes["institute"]],
update_institute_funding?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["institute_funding_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["institute_funding_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["institute_funding_bool_exp"]},ResolverInputTypes["institute_funding_mutation_response"]],
update_institute_funding_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["institute_funding_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["institute_funding_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["institute_funding_pk_columns_input"]},ResolverInputTypes["institute_funding"]],
update_institute_funding_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["institute_funding_updates"]>},ResolverInputTypes["institute_funding_mutation_response"]],
update_institute_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["institute_updates"]>},ResolverInputTypes["institute_mutation_response"]],
		__typename?: boolean | `@${string}`
}>;
	/** column ordering options */
["order_by"]:order_by;
	["query_root"]: AliasType<{
STATUS?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["STATUS_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["STATUS_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["STATUS_bool_exp"] | undefined | null},ResolverInputTypes["STATUS"]],
STATUS_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["STATUS_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["STATUS_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["STATUS_bool_exp"] | undefined | null},ResolverInputTypes["STATUS_aggregate"]],
STATUS_by_pk?: [{	value: string},ResolverInputTypes["STATUS"]],
e_governance?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["e_governance_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["e_governance_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["e_governance_bool_exp"] | undefined | null},ResolverInputTypes["e_governance"]],
e_governance_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["e_governance_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["e_governance_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["e_governance_bool_exp"] | undefined | null},ResolverInputTypes["e_governance_aggregate"]],
e_governance_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["e_governance"]],
faculty?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_bool_exp"] | undefined | null},ResolverInputTypes["faculty"]],
faculty_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_bool_exp"] | undefined | null},ResolverInputTypes["faculty_aggregate"]],
faculty_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["faculty"]],
faculty_funding?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null},ResolverInputTypes["faculty_funding"]],
faculty_funding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null},ResolverInputTypes["faculty_funding_aggregate"]],
faculty_funding_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["faculty_funding"]],
fdp_pdp?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["fdp_pdp_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["fdp_pdp_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null},ResolverInputTypes["fdp_pdp"]],
fdp_pdp_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["fdp_pdp_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["fdp_pdp_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null},ResolverInputTypes["fdp_pdp_aggregate"]],
fdp_pdp_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["fdp_pdp"]],
genesis?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["genesis_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["genesis_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["genesis_bool_exp"] | undefined | null},ResolverInputTypes["genesis"]],
genesis_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["genesis_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["genesis_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["genesis_bool_exp"] | undefined | null},ResolverInputTypes["genesis_aggregate"]],
genesis_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["genesis"]],
institute?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["institute_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["institute_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["institute_bool_exp"] | undefined | null},ResolverInputTypes["institute"]],
institute_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["institute_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["institute_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["institute_bool_exp"] | undefined | null},ResolverInputTypes["institute_aggregate"]],
institute_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["institute"]],
institute_funding?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["institute_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["institute_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["institute_funding_bool_exp"] | undefined | null},ResolverInputTypes["institute_funding"]],
institute_funding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["institute_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["institute_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["institute_funding_bool_exp"] | undefined | null},ResolverInputTypes["institute_funding_aggregate"]],
institute_funding_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["institute_funding"]],
		__typename?: boolean | `@${string}`
}>;
	["subscription_root"]: AliasType<{
STATUS?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["STATUS_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["STATUS_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["STATUS_bool_exp"] | undefined | null},ResolverInputTypes["STATUS"]],
STATUS_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["STATUS_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["STATUS_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["STATUS_bool_exp"] | undefined | null},ResolverInputTypes["STATUS_aggregate"]],
STATUS_by_pk?: [{	value: string},ResolverInputTypes["STATUS"]],
STATUS_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["STATUS_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["STATUS_bool_exp"] | undefined | null},ResolverInputTypes["STATUS"]],
e_governance?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["e_governance_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["e_governance_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["e_governance_bool_exp"] | undefined | null},ResolverInputTypes["e_governance"]],
e_governance_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["e_governance_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["e_governance_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["e_governance_bool_exp"] | undefined | null},ResolverInputTypes["e_governance_aggregate"]],
e_governance_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["e_governance"]],
e_governance_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["e_governance_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["e_governance_bool_exp"] | undefined | null},ResolverInputTypes["e_governance"]],
faculty?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_bool_exp"] | undefined | null},ResolverInputTypes["faculty"]],
faculty_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_bool_exp"] | undefined | null},ResolverInputTypes["faculty_aggregate"]],
faculty_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["faculty"]],
faculty_funding?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null},ResolverInputTypes["faculty_funding"]],
faculty_funding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["faculty_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["faculty_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null},ResolverInputTypes["faculty_funding_aggregate"]],
faculty_funding_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["faculty_funding"]],
faculty_funding_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["faculty_funding_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_funding_bool_exp"] | undefined | null},ResolverInputTypes["faculty_funding"]],
faculty_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["faculty_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["faculty_bool_exp"] | undefined | null},ResolverInputTypes["faculty"]],
fdp_pdp?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["fdp_pdp_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["fdp_pdp_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null},ResolverInputTypes["fdp_pdp"]],
fdp_pdp_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["fdp_pdp_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["fdp_pdp_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null},ResolverInputTypes["fdp_pdp_aggregate"]],
fdp_pdp_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["fdp_pdp"]],
fdp_pdp_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["fdp_pdp_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["fdp_pdp_bool_exp"] | undefined | null},ResolverInputTypes["fdp_pdp"]],
genesis?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["genesis_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["genesis_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["genesis_bool_exp"] | undefined | null},ResolverInputTypes["genesis"]],
genesis_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["genesis_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["genesis_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["genesis_bool_exp"] | undefined | null},ResolverInputTypes["genesis_aggregate"]],
genesis_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["genesis"]],
genesis_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["genesis_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["genesis_bool_exp"] | undefined | null},ResolverInputTypes["genesis"]],
institute?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["institute_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["institute_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["institute_bool_exp"] | undefined | null},ResolverInputTypes["institute"]],
institute_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["institute_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["institute_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["institute_bool_exp"] | undefined | null},ResolverInputTypes["institute_aggregate"]],
institute_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["institute"]],
institute_funding?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["institute_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["institute_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["institute_funding_bool_exp"] | undefined | null},ResolverInputTypes["institute_funding"]],
institute_funding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["institute_funding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["institute_funding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["institute_funding_bool_exp"] | undefined | null},ResolverInputTypes["institute_funding_aggregate"]],
institute_funding_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["institute_funding"]],
institute_funding_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["institute_funding_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["institute_funding_bool_exp"] | undefined | null},ResolverInputTypes["institute_funding"]],
institute_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["institute_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["institute_bool_exp"] | undefined | null},ResolverInputTypes["institute"]],
		__typename?: boolean | `@${string}`
}>;
	["timestamptz"]:unknown;
	/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
["timestamptz_comparison_exp"]: {
	_eq?: ResolverInputTypes["timestamptz"] | undefined | null,
	_gt?: ResolverInputTypes["timestamptz"] | undefined | null,
	_gte?: ResolverInputTypes["timestamptz"] | undefined | null,
	_in?: Array<ResolverInputTypes["timestamptz"]> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: ResolverInputTypes["timestamptz"] | undefined | null,
	_lte?: ResolverInputTypes["timestamptz"] | undefined | null,
	_neq?: ResolverInputTypes["timestamptz"] | undefined | null,
	_nin?: Array<ResolverInputTypes["timestamptz"]> | undefined | null
};
	["uuid"]:unknown;
	/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
["uuid_comparison_exp"]: {
	_eq?: ResolverInputTypes["uuid"] | undefined | null,
	_gt?: ResolverInputTypes["uuid"] | undefined | null,
	_gte?: ResolverInputTypes["uuid"] | undefined | null,
	_in?: Array<ResolverInputTypes["uuid"]> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: ResolverInputTypes["uuid"] | undefined | null,
	_lte?: ResolverInputTypes["uuid"] | undefined | null,
	_neq?: ResolverInputTypes["uuid"] | undefined | null,
	_nin?: Array<ResolverInputTypes["uuid"]> | undefined | null
}
  }

export type ModelTypes = {
    ["schema"]: {
	query?: ModelTypes["query_root"] | undefined,
	mutation?: ModelTypes["mutation_root"] | undefined,
	subscription?: ModelTypes["subscription_root"] | undefined
};
	/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
["Int_comparison_exp"]: {
	_eq?: number | undefined,
	_gt?: number | undefined,
	_gte?: number | undefined,
	_in?: Array<number> | undefined,
	_is_null?: boolean | undefined,
	_lt?: number | undefined,
	_lte?: number | undefined,
	_neq?: number | undefined,
	_nin?: Array<number> | undefined
};
	/** columns and relationships of "STATUS" */
["STATUS"]: {
		value: string
};
	/** aggregated selection of "STATUS" */
["STATUS_aggregate"]: {
		aggregate?: ModelTypes["STATUS_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["STATUS"]>
};
	/** aggregate fields of "STATUS" */
["STATUS_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["STATUS_max_fields"] | undefined,
	min?: ModelTypes["STATUS_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "STATUS". All fields are combined with a logical 'AND'. */
["STATUS_bool_exp"]: {
	_and?: Array<ModelTypes["STATUS_bool_exp"]> | undefined,
	_not?: ModelTypes["STATUS_bool_exp"] | undefined,
	_or?: Array<ModelTypes["STATUS_bool_exp"]> | undefined,
	value?: ModelTypes["String_comparison_exp"] | undefined
};
	["STATUS_constraint"]:STATUS_constraint;
	["STATUS_enum"]:STATUS_enum;
	/** Boolean expression to compare columns of type "STATUS_enum". All fields are combined with logical 'AND'. */
["STATUS_enum_comparison_exp"]: {
	_eq?: ModelTypes["STATUS_enum"] | undefined,
	_in?: Array<ModelTypes["STATUS_enum"]> | undefined,
	_is_null?: boolean | undefined,
	_neq?: ModelTypes["STATUS_enum"] | undefined,
	_nin?: Array<ModelTypes["STATUS_enum"]> | undefined
};
	/** input type for inserting data into table "STATUS" */
["STATUS_insert_input"]: {
	value?: string | undefined
};
	/** aggregate max on columns */
["STATUS_max_fields"]: {
		value?: string | undefined
};
	/** aggregate min on columns */
["STATUS_min_fields"]: {
		value?: string | undefined
};
	/** response of any mutation on the table "STATUS" */
["STATUS_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["STATUS"]>
};
	/** on_conflict condition type for table "STATUS" */
["STATUS_on_conflict"]: {
	constraint: ModelTypes["STATUS_constraint"],
	update_columns: Array<ModelTypes["STATUS_update_column"]>,
	where?: ModelTypes["STATUS_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "STATUS". */
["STATUS_order_by"]: {
	value?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: STATUS */
["STATUS_pk_columns_input"]: {
	value: string
};
	["STATUS_select_column"]:STATUS_select_column;
	/** input type for updating data in table "STATUS" */
["STATUS_set_input"]: {
	value?: string | undefined
};
	/** Streaming cursor of the table "STATUS" */
["STATUS_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["STATUS_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["STATUS_stream_cursor_value_input"]: {
	value?: string | undefined
};
	["STATUS_update_column"]:STATUS_update_column;
	["STATUS_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["STATUS_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["STATUS_bool_exp"]
};
	/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
["String_comparison_exp"]: {
	_eq?: string | undefined,
	_gt?: string | undefined,
	_gte?: string | undefined,
	/** does the column match the given case-insensitive pattern */
	_ilike?: string | undefined,
	_in?: Array<string> | undefined,
	/** does the column match the given POSIX regular expression, case insensitive */
	_iregex?: string | undefined,
	_is_null?: boolean | undefined,
	/** does the column match the given pattern */
	_like?: string | undefined,
	_lt?: string | undefined,
	_lte?: string | undefined,
	_neq?: string | undefined,
	/** does the column NOT match the given case-insensitive pattern */
	_nilike?: string | undefined,
	_nin?: Array<string> | undefined,
	/** does the column NOT match the given POSIX regular expression, case insensitive */
	_niregex?: string | undefined,
	/** does the column NOT match the given pattern */
	_nlike?: string | undefined,
	/** does the column NOT match the given POSIX regular expression, case sensitive */
	_nregex?: string | undefined,
	/** does the column NOT match the given SQL regular expression */
	_nsimilar?: string | undefined,
	/** does the column match the given POSIX regular expression, case sensitive */
	_regex?: string | undefined,
	/** does the column match the given SQL regular expression */
	_similar?: string | undefined
};
	["bigint"]:any;
	/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
["bigint_comparison_exp"]: {
	_eq?: ModelTypes["bigint"] | undefined,
	_gt?: ModelTypes["bigint"] | undefined,
	_gte?: ModelTypes["bigint"] | undefined,
	_in?: Array<ModelTypes["bigint"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: ModelTypes["bigint"] | undefined,
	_lte?: ModelTypes["bigint"] | undefined,
	_neq?: ModelTypes["bigint"] | undefined,
	_nin?: Array<ModelTypes["bigint"]> | undefined
};
	["cursor_ordering"]:cursor_ordering;
	["date"]:any;
	/** Boolean expression to compare columns of type "date". All fields are combined with logical 'AND'. */
["date_comparison_exp"]: {
	_eq?: ModelTypes["date"] | undefined,
	_gt?: ModelTypes["date"] | undefined,
	_gte?: ModelTypes["date"] | undefined,
	_in?: Array<ModelTypes["date"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: ModelTypes["date"] | undefined,
	_lte?: ModelTypes["date"] | undefined,
	_neq?: ModelTypes["date"] | undefined,
	_nin?: Array<ModelTypes["date"]> | undefined
};
	/** columns and relationships of "e_governance" */
["e_governance"]: {
		address: string,
	area: string,
	createdAt: ModelTypes["timestamptz"],
	createdById: ModelTypes["uuid"],
	cursorId: ModelTypes["bigint"],
	description: string,
	file: string,
	id: ModelTypes["uuid"],
	/** An object relationship */
	institute: ModelTypes["institute"],
	institute_id: ModelTypes["uuid"],
	name: string,
	phone_no: string,
	service_end_date: ModelTypes["date"],
	service_start_date: ModelTypes["date"],
	status: ModelTypes["STATUS_enum"],
	total_amount: string,
	updatedAt: ModelTypes["timestamptz"],
	updatedById?: ModelTypes["uuid"] | undefined,
	website: string
};
	/** aggregated selection of "e_governance" */
["e_governance_aggregate"]: {
		aggregate?: ModelTypes["e_governance_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["e_governance"]>
};
	["e_governance_aggregate_bool_exp"]: {
	count?: ModelTypes["e_governance_aggregate_bool_exp_count"] | undefined
};
	["e_governance_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["e_governance_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["e_governance_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "e_governance" */
["e_governance_aggregate_fields"]: {
		avg?: ModelTypes["e_governance_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["e_governance_max_fields"] | undefined,
	min?: ModelTypes["e_governance_min_fields"] | undefined,
	stddev?: ModelTypes["e_governance_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["e_governance_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["e_governance_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["e_governance_sum_fields"] | undefined,
	var_pop?: ModelTypes["e_governance_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["e_governance_var_samp_fields"] | undefined,
	variance?: ModelTypes["e_governance_variance_fields"] | undefined
};
	/** order by aggregate values of table "e_governance" */
["e_governance_aggregate_order_by"]: {
	avg?: ModelTypes["e_governance_avg_order_by"] | undefined,
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["e_governance_max_order_by"] | undefined,
	min?: ModelTypes["e_governance_min_order_by"] | undefined,
	stddev?: ModelTypes["e_governance_stddev_order_by"] | undefined,
	stddev_pop?: ModelTypes["e_governance_stddev_pop_order_by"] | undefined,
	stddev_samp?: ModelTypes["e_governance_stddev_samp_order_by"] | undefined,
	sum?: ModelTypes["e_governance_sum_order_by"] | undefined,
	var_pop?: ModelTypes["e_governance_var_pop_order_by"] | undefined,
	var_samp?: ModelTypes["e_governance_var_samp_order_by"] | undefined,
	variance?: ModelTypes["e_governance_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "e_governance" */
["e_governance_arr_rel_insert_input"]: {
	data: Array<ModelTypes["e_governance_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["e_governance_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["e_governance_avg_fields"]: {
		cursorId?: number | undefined
};
	/** order by avg() on columns of table "e_governance" */
["e_governance_avg_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "e_governance". All fields are combined with a logical 'AND'. */
["e_governance_bool_exp"]: {
	_and?: Array<ModelTypes["e_governance_bool_exp"]> | undefined,
	_not?: ModelTypes["e_governance_bool_exp"] | undefined,
	_or?: Array<ModelTypes["e_governance_bool_exp"]> | undefined,
	address?: ModelTypes["String_comparison_exp"] | undefined,
	area?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursorId?: ModelTypes["bigint_comparison_exp"] | undefined,
	description?: ModelTypes["String_comparison_exp"] | undefined,
	file?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	institute?: ModelTypes["institute_bool_exp"] | undefined,
	institute_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	phone_no?: ModelTypes["String_comparison_exp"] | undefined,
	service_end_date?: ModelTypes["date_comparison_exp"] | undefined,
	service_start_date?: ModelTypes["date_comparison_exp"] | undefined,
	status?: ModelTypes["STATUS_enum_comparison_exp"] | undefined,
	total_amount?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined,
	website?: ModelTypes["String_comparison_exp"] | undefined
};
	["e_governance_constraint"]:e_governance_constraint;
	/** input type for incrementing numeric columns in table "e_governance" */
["e_governance_inc_input"]: {
	cursorId?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "e_governance" */
["e_governance_insert_input"]: {
	address?: string | undefined,
	area?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute?: ModelTypes["institute_obj_rel_insert_input"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: ModelTypes["date"] | undefined,
	service_start_date?: ModelTypes["date"] | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	total_amount?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate max on columns */
["e_governance_max_fields"]: {
		address?: string | undefined,
	area?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: ModelTypes["date"] | undefined,
	service_start_date?: ModelTypes["date"] | undefined,
	total_amount?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** order by max() on columns of table "e_governance" */
["e_governance_max_order_by"]: {
	address?: ModelTypes["order_by"] | undefined,
	area?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	description?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	phone_no?: ModelTypes["order_by"] | undefined,
	service_end_date?: ModelTypes["order_by"] | undefined,
	service_start_date?: ModelTypes["order_by"] | undefined,
	total_amount?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
	website?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["e_governance_min_fields"]: {
		address?: string | undefined,
	area?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: ModelTypes["date"] | undefined,
	service_start_date?: ModelTypes["date"] | undefined,
	total_amount?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** order by min() on columns of table "e_governance" */
["e_governance_min_order_by"]: {
	address?: ModelTypes["order_by"] | undefined,
	area?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	description?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	phone_no?: ModelTypes["order_by"] | undefined,
	service_end_date?: ModelTypes["order_by"] | undefined,
	service_start_date?: ModelTypes["order_by"] | undefined,
	total_amount?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
	website?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "e_governance" */
["e_governance_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["e_governance"]>
};
	/** on_conflict condition type for table "e_governance" */
["e_governance_on_conflict"]: {
	constraint: ModelTypes["e_governance_constraint"],
	update_columns: Array<ModelTypes["e_governance_update_column"]>,
	where?: ModelTypes["e_governance_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "e_governance". */
["e_governance_order_by"]: {
	address?: ModelTypes["order_by"] | undefined,
	area?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	description?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute?: ModelTypes["institute_order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	phone_no?: ModelTypes["order_by"] | undefined,
	service_end_date?: ModelTypes["order_by"] | undefined,
	service_start_date?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	total_amount?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
	website?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: e_governance */
["e_governance_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["e_governance_select_column"]:e_governance_select_column;
	/** input type for updating data in table "e_governance" */
["e_governance_set_input"]: {
	address?: string | undefined,
	area?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: ModelTypes["date"] | undefined,
	service_start_date?: ModelTypes["date"] | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	total_amount?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate stddev on columns */
["e_governance_stddev_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev() on columns of table "e_governance" */
["e_governance_stddev_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["e_governance_stddev_pop_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev_pop() on columns of table "e_governance" */
["e_governance_stddev_pop_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["e_governance_stddev_samp_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev_samp() on columns of table "e_governance" */
["e_governance_stddev_samp_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "e_governance" */
["e_governance_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["e_governance_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["e_governance_stream_cursor_value_input"]: {
	address?: string | undefined,
	area?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: ModelTypes["date"] | undefined,
	service_start_date?: ModelTypes["date"] | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	total_amount?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate sum on columns */
["e_governance_sum_fields"]: {
		cursorId?: ModelTypes["bigint"] | undefined
};
	/** order by sum() on columns of table "e_governance" */
["e_governance_sum_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	["e_governance_update_column"]:e_governance_update_column;
	["e_governance_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["e_governance_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["e_governance_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["e_governance_bool_exp"]
};
	/** aggregate var_pop on columns */
["e_governance_var_pop_fields"]: {
		cursorId?: number | undefined
};
	/** order by var_pop() on columns of table "e_governance" */
["e_governance_var_pop_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["e_governance_var_samp_fields"]: {
		cursorId?: number | undefined
};
	/** order by var_samp() on columns of table "e_governance" */
["e_governance_var_samp_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["e_governance_variance_fields"]: {
		cursorId?: number | undefined
};
	/** order by variance() on columns of table "e_governance" */
["e_governance_variance_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** columns and relationships of "faculty" */
["faculty"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdAt: ModelTypes["timestamptz"],
	createdById: ModelTypes["uuid"],
	cursorId: ModelTypes["bigint"],
	date_of_joining: ModelTypes["date"],
	designation: string,
	dob?: ModelTypes["date"] | undefined,
	email_id: string,
	experience: string,
	/** An array relationship */
	faculty_fundings: Array<ModelTypes["faculty_funding"]>,
	/** An aggregate relationship */
	faculty_fundings_aggregate: ModelTypes["faculty_funding_aggregate"],
	/** An array relationship */
	fdp_pdps: Array<ModelTypes["fdp_pdp"]>,
	/** An aggregate relationship */
	fdp_pdps_aggregate: ModelTypes["fdp_pdp_aggregate"],
	gender: string,
	id: ModelTypes["uuid"],
	/** An object relationship */
	institute: ModelTypes["institute"],
	institute_id: ModelTypes["uuid"],
	job_type: string,
	minority?: string | undefined,
	name: string,
	pan_card_no?: string | undefined,
	phone: string,
	qualification: string,
	section?: string | undefined,
	staff_type: string,
	status: ModelTypes["STATUS_enum"],
	status_of_approval: string,
	updatedAt: ModelTypes["timestamptz"],
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregated selection of "faculty" */
["faculty_aggregate"]: {
		aggregate?: ModelTypes["faculty_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["faculty"]>
};
	["faculty_aggregate_bool_exp"]: {
	count?: ModelTypes["faculty_aggregate_bool_exp_count"] | undefined
};
	["faculty_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["faculty_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["faculty_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "faculty" */
["faculty_aggregate_fields"]: {
		avg?: ModelTypes["faculty_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["faculty_max_fields"] | undefined,
	min?: ModelTypes["faculty_min_fields"] | undefined,
	stddev?: ModelTypes["faculty_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["faculty_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["faculty_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["faculty_sum_fields"] | undefined,
	var_pop?: ModelTypes["faculty_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["faculty_var_samp_fields"] | undefined,
	variance?: ModelTypes["faculty_variance_fields"] | undefined
};
	/** order by aggregate values of table "faculty" */
["faculty_aggregate_order_by"]: {
	avg?: ModelTypes["faculty_avg_order_by"] | undefined,
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["faculty_max_order_by"] | undefined,
	min?: ModelTypes["faculty_min_order_by"] | undefined,
	stddev?: ModelTypes["faculty_stddev_order_by"] | undefined,
	stddev_pop?: ModelTypes["faculty_stddev_pop_order_by"] | undefined,
	stddev_samp?: ModelTypes["faculty_stddev_samp_order_by"] | undefined,
	sum?: ModelTypes["faculty_sum_order_by"] | undefined,
	var_pop?: ModelTypes["faculty_var_pop_order_by"] | undefined,
	var_samp?: ModelTypes["faculty_var_samp_order_by"] | undefined,
	variance?: ModelTypes["faculty_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "faculty" */
["faculty_arr_rel_insert_input"]: {
	data: Array<ModelTypes["faculty_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["faculty_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["faculty_avg_fields"]: {
		cursorId?: number | undefined
};
	/** order by avg() on columns of table "faculty" */
["faculty_avg_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "faculty". All fields are combined with a logical 'AND'. */
["faculty_bool_exp"]: {
	_and?: Array<ModelTypes["faculty_bool_exp"]> | undefined,
	_not?: ModelTypes["faculty_bool_exp"] | undefined,
	_or?: Array<ModelTypes["faculty_bool_exp"]> | undefined,
	address?: ModelTypes["String_comparison_exp"] | undefined,
	cast?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursorId?: ModelTypes["bigint_comparison_exp"] | undefined,
	date_of_joining?: ModelTypes["date_comparison_exp"] | undefined,
	designation?: ModelTypes["String_comparison_exp"] | undefined,
	dob?: ModelTypes["date_comparison_exp"] | undefined,
	email_id?: ModelTypes["String_comparison_exp"] | undefined,
	experience?: ModelTypes["String_comparison_exp"] | undefined,
	faculty_fundings?: ModelTypes["faculty_funding_bool_exp"] | undefined,
	faculty_fundings_aggregate?: ModelTypes["faculty_funding_aggregate_bool_exp"] | undefined,
	fdp_pdps?: ModelTypes["fdp_pdp_bool_exp"] | undefined,
	fdp_pdps_aggregate?: ModelTypes["fdp_pdp_aggregate_bool_exp"] | undefined,
	gender?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	institute?: ModelTypes["institute_bool_exp"] | undefined,
	institute_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	job_type?: ModelTypes["String_comparison_exp"] | undefined,
	minority?: ModelTypes["String_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	pan_card_no?: ModelTypes["String_comparison_exp"] | undefined,
	phone?: ModelTypes["String_comparison_exp"] | undefined,
	qualification?: ModelTypes["String_comparison_exp"] | undefined,
	section?: ModelTypes["String_comparison_exp"] | undefined,
	staff_type?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["STATUS_enum_comparison_exp"] | undefined,
	status_of_approval?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["faculty_constraint"]:faculty_constraint;
	/** columns and relationships of "faculty_funding" */
["faculty_funding"]: {
		amount: string,
	createdAt: ModelTypes["timestamptz"],
	createdById: ModelTypes["uuid"],
	cursorId: ModelTypes["bigint"],
	/** An object relationship */
	faculty: ModelTypes["faculty"],
	faculty_id: ModelTypes["uuid"],
	file: string,
	id: ModelTypes["uuid"],
	/** An object relationship */
	institute: ModelTypes["institute"],
	institute_id: ModelTypes["uuid"],
	nature: string,
	status: ModelTypes["STATUS_enum"],
	transaction_date: ModelTypes["date"],
	transaction_type: string,
	type: string,
	updatedAt: ModelTypes["timestamptz"],
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregated selection of "faculty_funding" */
["faculty_funding_aggregate"]: {
		aggregate?: ModelTypes["faculty_funding_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["faculty_funding"]>
};
	["faculty_funding_aggregate_bool_exp"]: {
	count?: ModelTypes["faculty_funding_aggregate_bool_exp_count"] | undefined
};
	["faculty_funding_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["faculty_funding_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["faculty_funding_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "faculty_funding" */
["faculty_funding_aggregate_fields"]: {
		avg?: ModelTypes["faculty_funding_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["faculty_funding_max_fields"] | undefined,
	min?: ModelTypes["faculty_funding_min_fields"] | undefined,
	stddev?: ModelTypes["faculty_funding_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["faculty_funding_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["faculty_funding_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["faculty_funding_sum_fields"] | undefined,
	var_pop?: ModelTypes["faculty_funding_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["faculty_funding_var_samp_fields"] | undefined,
	variance?: ModelTypes["faculty_funding_variance_fields"] | undefined
};
	/** order by aggregate values of table "faculty_funding" */
["faculty_funding_aggregate_order_by"]: {
	avg?: ModelTypes["faculty_funding_avg_order_by"] | undefined,
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["faculty_funding_max_order_by"] | undefined,
	min?: ModelTypes["faculty_funding_min_order_by"] | undefined,
	stddev?: ModelTypes["faculty_funding_stddev_order_by"] | undefined,
	stddev_pop?: ModelTypes["faculty_funding_stddev_pop_order_by"] | undefined,
	stddev_samp?: ModelTypes["faculty_funding_stddev_samp_order_by"] | undefined,
	sum?: ModelTypes["faculty_funding_sum_order_by"] | undefined,
	var_pop?: ModelTypes["faculty_funding_var_pop_order_by"] | undefined,
	var_samp?: ModelTypes["faculty_funding_var_samp_order_by"] | undefined,
	variance?: ModelTypes["faculty_funding_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "faculty_funding" */
["faculty_funding_arr_rel_insert_input"]: {
	data: Array<ModelTypes["faculty_funding_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["faculty_funding_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["faculty_funding_avg_fields"]: {
		cursorId?: number | undefined
};
	/** order by avg() on columns of table "faculty_funding" */
["faculty_funding_avg_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "faculty_funding". All fields are combined with a logical 'AND'. */
["faculty_funding_bool_exp"]: {
	_and?: Array<ModelTypes["faculty_funding_bool_exp"]> | undefined,
	_not?: ModelTypes["faculty_funding_bool_exp"] | undefined,
	_or?: Array<ModelTypes["faculty_funding_bool_exp"]> | undefined,
	amount?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursorId?: ModelTypes["bigint_comparison_exp"] | undefined,
	faculty?: ModelTypes["faculty_bool_exp"] | undefined,
	faculty_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	file?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	institute?: ModelTypes["institute_bool_exp"] | undefined,
	institute_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	nature?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["STATUS_enum_comparison_exp"] | undefined,
	transaction_date?: ModelTypes["date_comparison_exp"] | undefined,
	transaction_type?: ModelTypes["String_comparison_exp"] | undefined,
	type?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["faculty_funding_constraint"]:faculty_funding_constraint;
	/** input type for incrementing numeric columns in table "faculty_funding" */
["faculty_funding_inc_input"]: {
	cursorId?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "faculty_funding" */
["faculty_funding_insert_input"]: {
	amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	faculty?: ModelTypes["faculty_obj_rel_insert_input"] | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute?: ModelTypes["institute_obj_rel_insert_input"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["faculty_funding_max_fields"]: {
		amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** order by max() on columns of table "faculty_funding" */
["faculty_funding_max_order_by"]: {
	amount?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	faculty_id?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	nature?: ModelTypes["order_by"] | undefined,
	transaction_date?: ModelTypes["order_by"] | undefined,
	transaction_type?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["faculty_funding_min_fields"]: {
		amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** order by min() on columns of table "faculty_funding" */
["faculty_funding_min_order_by"]: {
	amount?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	faculty_id?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	nature?: ModelTypes["order_by"] | undefined,
	transaction_date?: ModelTypes["order_by"] | undefined,
	transaction_type?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "faculty_funding" */
["faculty_funding_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["faculty_funding"]>
};
	/** on_conflict condition type for table "faculty_funding" */
["faculty_funding_on_conflict"]: {
	constraint: ModelTypes["faculty_funding_constraint"],
	update_columns: Array<ModelTypes["faculty_funding_update_column"]>,
	where?: ModelTypes["faculty_funding_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "faculty_funding". */
["faculty_funding_order_by"]: {
	amount?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	faculty?: ModelTypes["faculty_order_by"] | undefined,
	faculty_id?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute?: ModelTypes["institute_order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	nature?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	transaction_date?: ModelTypes["order_by"] | undefined,
	transaction_type?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: faculty_funding */
["faculty_funding_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["faculty_funding_select_column"]:faculty_funding_select_column;
	/** input type for updating data in table "faculty_funding" */
["faculty_funding_set_input"]: {
	amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["faculty_funding_stddev_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev() on columns of table "faculty_funding" */
["faculty_funding_stddev_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["faculty_funding_stddev_pop_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev_pop() on columns of table "faculty_funding" */
["faculty_funding_stddev_pop_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["faculty_funding_stddev_samp_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev_samp() on columns of table "faculty_funding" */
["faculty_funding_stddev_samp_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "faculty_funding" */
["faculty_funding_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["faculty_funding_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["faculty_funding_stream_cursor_value_input"]: {
	amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["faculty_funding_sum_fields"]: {
		cursorId?: ModelTypes["bigint"] | undefined
};
	/** order by sum() on columns of table "faculty_funding" */
["faculty_funding_sum_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	["faculty_funding_update_column"]:faculty_funding_update_column;
	["faculty_funding_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["faculty_funding_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["faculty_funding_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["faculty_funding_bool_exp"]
};
	/** aggregate var_pop on columns */
["faculty_funding_var_pop_fields"]: {
		cursorId?: number | undefined
};
	/** order by var_pop() on columns of table "faculty_funding" */
["faculty_funding_var_pop_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["faculty_funding_var_samp_fields"]: {
		cursorId?: number | undefined
};
	/** order by var_samp() on columns of table "faculty_funding" */
["faculty_funding_var_samp_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["faculty_funding_variance_fields"]: {
		cursorId?: number | undefined
};
	/** order by variance() on columns of table "faculty_funding" */
["faculty_funding_variance_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** input type for incrementing numeric columns in table "faculty" */
["faculty_inc_input"]: {
	cursorId?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "faculty" */
["faculty_insert_input"]: {
	address?: string | undefined,
	cast?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_of_joining?: ModelTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: ModelTypes["date"] | undefined,
	email_id?: string | undefined,
	experience?: string | undefined,
	faculty_fundings?: ModelTypes["faculty_funding_arr_rel_insert_input"] | undefined,
	fdp_pdps?: ModelTypes["fdp_pdp_arr_rel_insert_input"] | undefined,
	gender?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute?: ModelTypes["institute_obj_rel_insert_input"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	job_type?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	pan_card_no?: string | undefined,
	phone?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staff_type?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	status_of_approval?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["faculty_max_fields"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_of_joining?: ModelTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: ModelTypes["date"] | undefined,
	email_id?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	job_type?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	pan_card_no?: string | undefined,
	phone?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staff_type?: string | undefined,
	status_of_approval?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** order by max() on columns of table "faculty" */
["faculty_max_order_by"]: {
	address?: ModelTypes["order_by"] | undefined,
	cast?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	date_of_joining?: ModelTypes["order_by"] | undefined,
	designation?: ModelTypes["order_by"] | undefined,
	dob?: ModelTypes["order_by"] | undefined,
	email_id?: ModelTypes["order_by"] | undefined,
	experience?: ModelTypes["order_by"] | undefined,
	gender?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	job_type?: ModelTypes["order_by"] | undefined,
	minority?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	pan_card_no?: ModelTypes["order_by"] | undefined,
	phone?: ModelTypes["order_by"] | undefined,
	qualification?: ModelTypes["order_by"] | undefined,
	section?: ModelTypes["order_by"] | undefined,
	staff_type?: ModelTypes["order_by"] | undefined,
	status_of_approval?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["faculty_min_fields"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_of_joining?: ModelTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: ModelTypes["date"] | undefined,
	email_id?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	job_type?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	pan_card_no?: string | undefined,
	phone?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staff_type?: string | undefined,
	status_of_approval?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** order by min() on columns of table "faculty" */
["faculty_min_order_by"]: {
	address?: ModelTypes["order_by"] | undefined,
	cast?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	date_of_joining?: ModelTypes["order_by"] | undefined,
	designation?: ModelTypes["order_by"] | undefined,
	dob?: ModelTypes["order_by"] | undefined,
	email_id?: ModelTypes["order_by"] | undefined,
	experience?: ModelTypes["order_by"] | undefined,
	gender?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	job_type?: ModelTypes["order_by"] | undefined,
	minority?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	pan_card_no?: ModelTypes["order_by"] | undefined,
	phone?: ModelTypes["order_by"] | undefined,
	qualification?: ModelTypes["order_by"] | undefined,
	section?: ModelTypes["order_by"] | undefined,
	staff_type?: ModelTypes["order_by"] | undefined,
	status_of_approval?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "faculty" */
["faculty_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["faculty"]>
};
	/** input type for inserting object relation for remote table "faculty" */
["faculty_obj_rel_insert_input"]: {
	data: ModelTypes["faculty_insert_input"],
	/** upsert condition */
	on_conflict?: ModelTypes["faculty_on_conflict"] | undefined
};
	/** on_conflict condition type for table "faculty" */
["faculty_on_conflict"]: {
	constraint: ModelTypes["faculty_constraint"],
	update_columns: Array<ModelTypes["faculty_update_column"]>,
	where?: ModelTypes["faculty_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "faculty". */
["faculty_order_by"]: {
	address?: ModelTypes["order_by"] | undefined,
	cast?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	date_of_joining?: ModelTypes["order_by"] | undefined,
	designation?: ModelTypes["order_by"] | undefined,
	dob?: ModelTypes["order_by"] | undefined,
	email_id?: ModelTypes["order_by"] | undefined,
	experience?: ModelTypes["order_by"] | undefined,
	faculty_fundings_aggregate?: ModelTypes["faculty_funding_aggregate_order_by"] | undefined,
	fdp_pdps_aggregate?: ModelTypes["fdp_pdp_aggregate_order_by"] | undefined,
	gender?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute?: ModelTypes["institute_order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	job_type?: ModelTypes["order_by"] | undefined,
	minority?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	pan_card_no?: ModelTypes["order_by"] | undefined,
	phone?: ModelTypes["order_by"] | undefined,
	qualification?: ModelTypes["order_by"] | undefined,
	section?: ModelTypes["order_by"] | undefined,
	staff_type?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	status_of_approval?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: faculty */
["faculty_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["faculty_select_column"]:faculty_select_column;
	/** input type for updating data in table "faculty" */
["faculty_set_input"]: {
	address?: string | undefined,
	cast?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_of_joining?: ModelTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: ModelTypes["date"] | undefined,
	email_id?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	job_type?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	pan_card_no?: string | undefined,
	phone?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staff_type?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	status_of_approval?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["faculty_stddev_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev() on columns of table "faculty" */
["faculty_stddev_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["faculty_stddev_pop_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev_pop() on columns of table "faculty" */
["faculty_stddev_pop_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["faculty_stddev_samp_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev_samp() on columns of table "faculty" */
["faculty_stddev_samp_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "faculty" */
["faculty_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["faculty_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["faculty_stream_cursor_value_input"]: {
	address?: string | undefined,
	cast?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_of_joining?: ModelTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: ModelTypes["date"] | undefined,
	email_id?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	job_type?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	pan_card_no?: string | undefined,
	phone?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staff_type?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	status_of_approval?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["faculty_sum_fields"]: {
		cursorId?: ModelTypes["bigint"] | undefined
};
	/** order by sum() on columns of table "faculty" */
["faculty_sum_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	["faculty_update_column"]:faculty_update_column;
	["faculty_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["faculty_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["faculty_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["faculty_bool_exp"]
};
	/** aggregate var_pop on columns */
["faculty_var_pop_fields"]: {
		cursorId?: number | undefined
};
	/** order by var_pop() on columns of table "faculty" */
["faculty_var_pop_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["faculty_var_samp_fields"]: {
		cursorId?: number | undefined
};
	/** order by var_samp() on columns of table "faculty" */
["faculty_var_samp_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["faculty_variance_fields"]: {
		cursorId?: number | undefined
};
	/** order by variance() on columns of table "faculty" */
["faculty_variance_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** columns and relationships of "fdp_pdp" */
["fdp_pdp"]: {
		createdAt: ModelTypes["timestamptz"],
	createdById: ModelTypes["uuid"],
	cursorId: ModelTypes["bigint"],
	date_from: ModelTypes["date"],
	date_to: ModelTypes["date"],
	description: string,
	/** An object relationship */
	faculty: ModelTypes["faculty"],
	faculty_id: ModelTypes["uuid"],
	file: string,
	id: ModelTypes["uuid"],
	/** An object relationship */
	institute: ModelTypes["institute"],
	institute_id: ModelTypes["uuid"],
	name: string,
	nature: string,
	status: ModelTypes["STATUS_enum"],
	type: string,
	updatedAt: ModelTypes["timestamptz"],
	updatedById?: ModelTypes["uuid"] | undefined,
	venue: string
};
	/** aggregated selection of "fdp_pdp" */
["fdp_pdp_aggregate"]: {
		aggregate?: ModelTypes["fdp_pdp_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["fdp_pdp"]>
};
	["fdp_pdp_aggregate_bool_exp"]: {
	count?: ModelTypes["fdp_pdp_aggregate_bool_exp_count"] | undefined
};
	["fdp_pdp_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["fdp_pdp_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["fdp_pdp_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "fdp_pdp" */
["fdp_pdp_aggregate_fields"]: {
		avg?: ModelTypes["fdp_pdp_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["fdp_pdp_max_fields"] | undefined,
	min?: ModelTypes["fdp_pdp_min_fields"] | undefined,
	stddev?: ModelTypes["fdp_pdp_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["fdp_pdp_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["fdp_pdp_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["fdp_pdp_sum_fields"] | undefined,
	var_pop?: ModelTypes["fdp_pdp_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["fdp_pdp_var_samp_fields"] | undefined,
	variance?: ModelTypes["fdp_pdp_variance_fields"] | undefined
};
	/** order by aggregate values of table "fdp_pdp" */
["fdp_pdp_aggregate_order_by"]: {
	avg?: ModelTypes["fdp_pdp_avg_order_by"] | undefined,
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["fdp_pdp_max_order_by"] | undefined,
	min?: ModelTypes["fdp_pdp_min_order_by"] | undefined,
	stddev?: ModelTypes["fdp_pdp_stddev_order_by"] | undefined,
	stddev_pop?: ModelTypes["fdp_pdp_stddev_pop_order_by"] | undefined,
	stddev_samp?: ModelTypes["fdp_pdp_stddev_samp_order_by"] | undefined,
	sum?: ModelTypes["fdp_pdp_sum_order_by"] | undefined,
	var_pop?: ModelTypes["fdp_pdp_var_pop_order_by"] | undefined,
	var_samp?: ModelTypes["fdp_pdp_var_samp_order_by"] | undefined,
	variance?: ModelTypes["fdp_pdp_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "fdp_pdp" */
["fdp_pdp_arr_rel_insert_input"]: {
	data: Array<ModelTypes["fdp_pdp_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["fdp_pdp_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["fdp_pdp_avg_fields"]: {
		cursorId?: number | undefined
};
	/** order by avg() on columns of table "fdp_pdp" */
["fdp_pdp_avg_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "fdp_pdp". All fields are combined with a logical 'AND'. */
["fdp_pdp_bool_exp"]: {
	_and?: Array<ModelTypes["fdp_pdp_bool_exp"]> | undefined,
	_not?: ModelTypes["fdp_pdp_bool_exp"] | undefined,
	_or?: Array<ModelTypes["fdp_pdp_bool_exp"]> | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursorId?: ModelTypes["bigint_comparison_exp"] | undefined,
	date_from?: ModelTypes["date_comparison_exp"] | undefined,
	date_to?: ModelTypes["date_comparison_exp"] | undefined,
	description?: ModelTypes["String_comparison_exp"] | undefined,
	faculty?: ModelTypes["faculty_bool_exp"] | undefined,
	faculty_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	file?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	institute?: ModelTypes["institute_bool_exp"] | undefined,
	institute_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	nature?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["STATUS_enum_comparison_exp"] | undefined,
	type?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined,
	venue?: ModelTypes["String_comparison_exp"] | undefined
};
	["fdp_pdp_constraint"]:fdp_pdp_constraint;
	/** input type for incrementing numeric columns in table "fdp_pdp" */
["fdp_pdp_inc_input"]: {
	cursorId?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "fdp_pdp" */
["fdp_pdp_insert_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_from?: ModelTypes["date"] | undefined,
	date_to?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	faculty?: ModelTypes["faculty_obj_rel_insert_input"] | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute?: ModelTypes["institute_obj_rel_insert_input"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate max on columns */
["fdp_pdp_max_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_from?: ModelTypes["date"] | undefined,
	date_to?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** order by max() on columns of table "fdp_pdp" */
["fdp_pdp_max_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	date_from?: ModelTypes["order_by"] | undefined,
	date_to?: ModelTypes["order_by"] | undefined,
	description?: ModelTypes["order_by"] | undefined,
	faculty_id?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	nature?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
	venue?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["fdp_pdp_min_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_from?: ModelTypes["date"] | undefined,
	date_to?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** order by min() on columns of table "fdp_pdp" */
["fdp_pdp_min_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	date_from?: ModelTypes["order_by"] | undefined,
	date_to?: ModelTypes["order_by"] | undefined,
	description?: ModelTypes["order_by"] | undefined,
	faculty_id?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	nature?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
	venue?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "fdp_pdp" */
["fdp_pdp_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["fdp_pdp"]>
};
	/** on_conflict condition type for table "fdp_pdp" */
["fdp_pdp_on_conflict"]: {
	constraint: ModelTypes["fdp_pdp_constraint"],
	update_columns: Array<ModelTypes["fdp_pdp_update_column"]>,
	where?: ModelTypes["fdp_pdp_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "fdp_pdp". */
["fdp_pdp_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	date_from?: ModelTypes["order_by"] | undefined,
	date_to?: ModelTypes["order_by"] | undefined,
	description?: ModelTypes["order_by"] | undefined,
	faculty?: ModelTypes["faculty_order_by"] | undefined,
	faculty_id?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute?: ModelTypes["institute_order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	nature?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
	venue?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: fdp_pdp */
["fdp_pdp_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["fdp_pdp_select_column"]:fdp_pdp_select_column;
	/** input type for updating data in table "fdp_pdp" */
["fdp_pdp_set_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_from?: ModelTypes["date"] | undefined,
	date_to?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate stddev on columns */
["fdp_pdp_stddev_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev() on columns of table "fdp_pdp" */
["fdp_pdp_stddev_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["fdp_pdp_stddev_pop_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev_pop() on columns of table "fdp_pdp" */
["fdp_pdp_stddev_pop_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["fdp_pdp_stddev_samp_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev_samp() on columns of table "fdp_pdp" */
["fdp_pdp_stddev_samp_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "fdp_pdp" */
["fdp_pdp_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["fdp_pdp_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["fdp_pdp_stream_cursor_value_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_from?: ModelTypes["date"] | undefined,
	date_to?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate sum on columns */
["fdp_pdp_sum_fields"]: {
		cursorId?: ModelTypes["bigint"] | undefined
};
	/** order by sum() on columns of table "fdp_pdp" */
["fdp_pdp_sum_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	["fdp_pdp_update_column"]:fdp_pdp_update_column;
	["fdp_pdp_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["fdp_pdp_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["fdp_pdp_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["fdp_pdp_bool_exp"]
};
	/** aggregate var_pop on columns */
["fdp_pdp_var_pop_fields"]: {
		cursorId?: number | undefined
};
	/** order by var_pop() on columns of table "fdp_pdp" */
["fdp_pdp_var_pop_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["fdp_pdp_var_samp_fields"]: {
		cursorId?: number | undefined
};
	/** order by var_samp() on columns of table "fdp_pdp" */
["fdp_pdp_var_samp_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["fdp_pdp_variance_fields"]: {
		cursorId?: number | undefined
};
	/** order by variance() on columns of table "fdp_pdp" */
["fdp_pdp_variance_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** columns and relationships of "genesis" */
["genesis"]: {
		createdAt: ModelTypes["timestamptz"],
	createdById: ModelTypes["uuid"],
	cursorId: ModelTypes["bigint"],
	email_id: string,
	id: ModelTypes["uuid"],
	isVerified: string,
	name: string,
	phone: string,
	role: string,
	status: ModelTypes["STATUS_enum"],
	updatedAt: ModelTypes["timestamptz"],
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregated selection of "genesis" */
["genesis_aggregate"]: {
		aggregate?: ModelTypes["genesis_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["genesis"]>
};
	/** aggregate fields of "genesis" */
["genesis_aggregate_fields"]: {
		avg?: ModelTypes["genesis_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["genesis_max_fields"] | undefined,
	min?: ModelTypes["genesis_min_fields"] | undefined,
	stddev?: ModelTypes["genesis_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["genesis_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["genesis_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["genesis_sum_fields"] | undefined,
	var_pop?: ModelTypes["genesis_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["genesis_var_samp_fields"] | undefined,
	variance?: ModelTypes["genesis_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["genesis_avg_fields"]: {
		cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "genesis". All fields are combined with a logical 'AND'. */
["genesis_bool_exp"]: {
	_and?: Array<ModelTypes["genesis_bool_exp"]> | undefined,
	_not?: ModelTypes["genesis_bool_exp"] | undefined,
	_or?: Array<ModelTypes["genesis_bool_exp"]> | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursorId?: ModelTypes["bigint_comparison_exp"] | undefined,
	email_id?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	isVerified?: ModelTypes["String_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	phone?: ModelTypes["String_comparison_exp"] | undefined,
	role?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["STATUS_enum_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["genesis_constraint"]:genesis_constraint;
	/** input type for incrementing numeric columns in table "genesis" */
["genesis_inc_input"]: {
	cursorId?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "genesis" */
["genesis_insert_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	email_id?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isVerified?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["genesis_max_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	email_id?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isVerified?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate min on columns */
["genesis_min_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	email_id?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isVerified?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** response of any mutation on the table "genesis" */
["genesis_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["genesis"]>
};
	/** on_conflict condition type for table "genesis" */
["genesis_on_conflict"]: {
	constraint: ModelTypes["genesis_constraint"],
	update_columns: Array<ModelTypes["genesis_update_column"]>,
	where?: ModelTypes["genesis_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "genesis". */
["genesis_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	email_id?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	isVerified?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	phone?: ModelTypes["order_by"] | undefined,
	role?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: genesis */
["genesis_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["genesis_select_column"]:genesis_select_column;
	/** input type for updating data in table "genesis" */
["genesis_set_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	email_id?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isVerified?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["genesis_stddev_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["genesis_stddev_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["genesis_stddev_samp_fields"]: {
		cursorId?: number | undefined
};
	/** Streaming cursor of the table "genesis" */
["genesis_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["genesis_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["genesis_stream_cursor_value_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	email_id?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isVerified?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["genesis_sum_fields"]: {
		cursorId?: ModelTypes["bigint"] | undefined
};
	["genesis_update_column"]:genesis_update_column;
	["genesis_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["genesis_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["genesis_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["genesis_bool_exp"]
};
	/** aggregate var_pop on columns */
["genesis_var_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["genesis_var_samp_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate variance on columns */
["genesis_variance_fields"]: {
		cursorId?: number | undefined
};
	/** columns and relationships of "institute" */
["institute"]: {
		address: string,
	city: string,
	createdAt: ModelTypes["timestamptz"],
	createdById: ModelTypes["uuid"],
	cursorId: ModelTypes["bigint"],
	date_of_establishment: ModelTypes["date"],
	/** An array relationship */
	e_governances: Array<ModelTypes["e_governance"]>,
	/** An aggregate relationship */
	e_governances_aggregate: ModelTypes["e_governance_aggregate"],
	/** An array relationship */
	faculties: Array<ModelTypes["faculty"]>,
	/** An aggregate relationship */
	faculties_aggregate: ModelTypes["faculty_aggregate"],
	/** An array relationship */
	faculty_fundings: Array<ModelTypes["faculty_funding"]>,
	/** An aggregate relationship */
	faculty_fundings_aggregate: ModelTypes["faculty_funding_aggregate"],
	/** An array relationship */
	fdp_pdps: Array<ModelTypes["fdp_pdp"]>,
	/** An aggregate relationship */
	fdp_pdps_aggregate: ModelTypes["fdp_pdp_aggregate"],
	id: ModelTypes["uuid"],
	/** An array relationship */
	institute_fundings: Array<ModelTypes["institute_funding"]>,
	/** An aggregate relationship */
	institute_fundings_aggregate: ModelTypes["institute_funding_aggregate"],
	landmark: string,
	name: string,
	pin: string,
	state: string,
	status: ModelTypes["STATUS_enum"],
	type: string,
	updatedAt: ModelTypes["timestamptz"],
	updatedById?: ModelTypes["uuid"] | undefined,
	website: string
};
	/** aggregated selection of "institute" */
["institute_aggregate"]: {
		aggregate?: ModelTypes["institute_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["institute"]>
};
	/** aggregate fields of "institute" */
["institute_aggregate_fields"]: {
		avg?: ModelTypes["institute_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["institute_max_fields"] | undefined,
	min?: ModelTypes["institute_min_fields"] | undefined,
	stddev?: ModelTypes["institute_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["institute_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["institute_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["institute_sum_fields"] | undefined,
	var_pop?: ModelTypes["institute_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["institute_var_samp_fields"] | undefined,
	variance?: ModelTypes["institute_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["institute_avg_fields"]: {
		cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "institute". All fields are combined with a logical 'AND'. */
["institute_bool_exp"]: {
	_and?: Array<ModelTypes["institute_bool_exp"]> | undefined,
	_not?: ModelTypes["institute_bool_exp"] | undefined,
	_or?: Array<ModelTypes["institute_bool_exp"]> | undefined,
	address?: ModelTypes["String_comparison_exp"] | undefined,
	city?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursorId?: ModelTypes["bigint_comparison_exp"] | undefined,
	date_of_establishment?: ModelTypes["date_comparison_exp"] | undefined,
	e_governances?: ModelTypes["e_governance_bool_exp"] | undefined,
	e_governances_aggregate?: ModelTypes["e_governance_aggregate_bool_exp"] | undefined,
	faculties?: ModelTypes["faculty_bool_exp"] | undefined,
	faculties_aggregate?: ModelTypes["faculty_aggregate_bool_exp"] | undefined,
	faculty_fundings?: ModelTypes["faculty_funding_bool_exp"] | undefined,
	faculty_fundings_aggregate?: ModelTypes["faculty_funding_aggregate_bool_exp"] | undefined,
	fdp_pdps?: ModelTypes["fdp_pdp_bool_exp"] | undefined,
	fdp_pdps_aggregate?: ModelTypes["fdp_pdp_aggregate_bool_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	institute_fundings?: ModelTypes["institute_funding_bool_exp"] | undefined,
	institute_fundings_aggregate?: ModelTypes["institute_funding_aggregate_bool_exp"] | undefined,
	landmark?: ModelTypes["String_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	pin?: ModelTypes["String_comparison_exp"] | undefined,
	state?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["STATUS_enum_comparison_exp"] | undefined,
	type?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined,
	website?: ModelTypes["String_comparison_exp"] | undefined
};
	["institute_constraint"]:institute_constraint;
	/** columns and relationships of "institute_funding" */
["institute_funding"]: {
		amount: string,
	createdAt: ModelTypes["timestamptz"],
	createdById: ModelTypes["uuid"],
	cursorId: ModelTypes["bigint"],
	id: ModelTypes["uuid"],
	/** An object relationship */
	institute: ModelTypes["institute"],
	institute_id: ModelTypes["uuid"],
	name: string,
	purpose: string,
	status: ModelTypes["STATUS_enum"],
	transaction_date: ModelTypes["date"],
	transaction_type: string,
	type: string,
	updatedAt: ModelTypes["timestamptz"],
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregated selection of "institute_funding" */
["institute_funding_aggregate"]: {
		aggregate?: ModelTypes["institute_funding_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["institute_funding"]>
};
	["institute_funding_aggregate_bool_exp"]: {
	count?: ModelTypes["institute_funding_aggregate_bool_exp_count"] | undefined
};
	["institute_funding_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["institute_funding_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["institute_funding_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "institute_funding" */
["institute_funding_aggregate_fields"]: {
		avg?: ModelTypes["institute_funding_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["institute_funding_max_fields"] | undefined,
	min?: ModelTypes["institute_funding_min_fields"] | undefined,
	stddev?: ModelTypes["institute_funding_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["institute_funding_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["institute_funding_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["institute_funding_sum_fields"] | undefined,
	var_pop?: ModelTypes["institute_funding_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["institute_funding_var_samp_fields"] | undefined,
	variance?: ModelTypes["institute_funding_variance_fields"] | undefined
};
	/** order by aggregate values of table "institute_funding" */
["institute_funding_aggregate_order_by"]: {
	avg?: ModelTypes["institute_funding_avg_order_by"] | undefined,
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["institute_funding_max_order_by"] | undefined,
	min?: ModelTypes["institute_funding_min_order_by"] | undefined,
	stddev?: ModelTypes["institute_funding_stddev_order_by"] | undefined,
	stddev_pop?: ModelTypes["institute_funding_stddev_pop_order_by"] | undefined,
	stddev_samp?: ModelTypes["institute_funding_stddev_samp_order_by"] | undefined,
	sum?: ModelTypes["institute_funding_sum_order_by"] | undefined,
	var_pop?: ModelTypes["institute_funding_var_pop_order_by"] | undefined,
	var_samp?: ModelTypes["institute_funding_var_samp_order_by"] | undefined,
	variance?: ModelTypes["institute_funding_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "institute_funding" */
["institute_funding_arr_rel_insert_input"]: {
	data: Array<ModelTypes["institute_funding_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["institute_funding_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["institute_funding_avg_fields"]: {
		cursorId?: number | undefined
};
	/** order by avg() on columns of table "institute_funding" */
["institute_funding_avg_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "institute_funding". All fields are combined with a logical 'AND'. */
["institute_funding_bool_exp"]: {
	_and?: Array<ModelTypes["institute_funding_bool_exp"]> | undefined,
	_not?: ModelTypes["institute_funding_bool_exp"] | undefined,
	_or?: Array<ModelTypes["institute_funding_bool_exp"]> | undefined,
	amount?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursorId?: ModelTypes["bigint_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	institute?: ModelTypes["institute_bool_exp"] | undefined,
	institute_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	purpose?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["STATUS_enum_comparison_exp"] | undefined,
	transaction_date?: ModelTypes["date_comparison_exp"] | undefined,
	transaction_type?: ModelTypes["String_comparison_exp"] | undefined,
	type?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["institute_funding_constraint"]:institute_funding_constraint;
	/** input type for incrementing numeric columns in table "institute_funding" */
["institute_funding_inc_input"]: {
	cursorId?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "institute_funding" */
["institute_funding_insert_input"]: {
	amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute?: ModelTypes["institute_obj_rel_insert_input"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["institute_funding_max_fields"]: {
		amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** order by max() on columns of table "institute_funding" */
["institute_funding_max_order_by"]: {
	amount?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	purpose?: ModelTypes["order_by"] | undefined,
	transaction_date?: ModelTypes["order_by"] | undefined,
	transaction_type?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["institute_funding_min_fields"]: {
		amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** order by min() on columns of table "institute_funding" */
["institute_funding_min_order_by"]: {
	amount?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	purpose?: ModelTypes["order_by"] | undefined,
	transaction_date?: ModelTypes["order_by"] | undefined,
	transaction_type?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "institute_funding" */
["institute_funding_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["institute_funding"]>
};
	/** on_conflict condition type for table "institute_funding" */
["institute_funding_on_conflict"]: {
	constraint: ModelTypes["institute_funding_constraint"],
	update_columns: Array<ModelTypes["institute_funding_update_column"]>,
	where?: ModelTypes["institute_funding_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "institute_funding". */
["institute_funding_order_by"]: {
	amount?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute?: ModelTypes["institute_order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	purpose?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	transaction_date?: ModelTypes["order_by"] | undefined,
	transaction_type?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: institute_funding */
["institute_funding_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["institute_funding_select_column"]:institute_funding_select_column;
	/** input type for updating data in table "institute_funding" */
["institute_funding_set_input"]: {
	amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["institute_funding_stddev_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev() on columns of table "institute_funding" */
["institute_funding_stddev_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["institute_funding_stddev_pop_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev_pop() on columns of table "institute_funding" */
["institute_funding_stddev_pop_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["institute_funding_stddev_samp_fields"]: {
		cursorId?: number | undefined
};
	/** order by stddev_samp() on columns of table "institute_funding" */
["institute_funding_stddev_samp_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "institute_funding" */
["institute_funding_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["institute_funding_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["institute_funding_stream_cursor_value_input"]: {
	amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["institute_funding_sum_fields"]: {
		cursorId?: ModelTypes["bigint"] | undefined
};
	/** order by sum() on columns of table "institute_funding" */
["institute_funding_sum_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	["institute_funding_update_column"]:institute_funding_update_column;
	["institute_funding_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["institute_funding_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["institute_funding_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["institute_funding_bool_exp"]
};
	/** aggregate var_pop on columns */
["institute_funding_var_pop_fields"]: {
		cursorId?: number | undefined
};
	/** order by var_pop() on columns of table "institute_funding" */
["institute_funding_var_pop_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["institute_funding_var_samp_fields"]: {
		cursorId?: number | undefined
};
	/** order by var_samp() on columns of table "institute_funding" */
["institute_funding_var_samp_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["institute_funding_variance_fields"]: {
		cursorId?: number | undefined
};
	/** order by variance() on columns of table "institute_funding" */
["institute_funding_variance_order_by"]: {
	cursorId?: ModelTypes["order_by"] | undefined
};
	/** input type for incrementing numeric columns in table "institute" */
["institute_inc_input"]: {
	cursorId?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "institute" */
["institute_insert_input"]: {
	address?: string | undefined,
	city?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_of_establishment?: ModelTypes["date"] | undefined,
	e_governances?: ModelTypes["e_governance_arr_rel_insert_input"] | undefined,
	faculties?: ModelTypes["faculty_arr_rel_insert_input"] | undefined,
	faculty_fundings?: ModelTypes["faculty_funding_arr_rel_insert_input"] | undefined,
	fdp_pdps?: ModelTypes["fdp_pdp_arr_rel_insert_input"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_fundings?: ModelTypes["institute_funding_arr_rel_insert_input"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate max on columns */
["institute_max_fields"]: {
		address?: string | undefined,
	city?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_of_establishment?: ModelTypes["date"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate min on columns */
["institute_min_fields"]: {
		address?: string | undefined,
	city?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_of_establishment?: ModelTypes["date"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** response of any mutation on the table "institute" */
["institute_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["institute"]>
};
	/** input type for inserting object relation for remote table "institute" */
["institute_obj_rel_insert_input"]: {
	data: ModelTypes["institute_insert_input"],
	/** upsert condition */
	on_conflict?: ModelTypes["institute_on_conflict"] | undefined
};
	/** on_conflict condition type for table "institute" */
["institute_on_conflict"]: {
	constraint: ModelTypes["institute_constraint"],
	update_columns: Array<ModelTypes["institute_update_column"]>,
	where?: ModelTypes["institute_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "institute". */
["institute_order_by"]: {
	address?: ModelTypes["order_by"] | undefined,
	city?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	date_of_establishment?: ModelTypes["order_by"] | undefined,
	e_governances_aggregate?: ModelTypes["e_governance_aggregate_order_by"] | undefined,
	faculties_aggregate?: ModelTypes["faculty_aggregate_order_by"] | undefined,
	faculty_fundings_aggregate?: ModelTypes["faculty_funding_aggregate_order_by"] | undefined,
	fdp_pdps_aggregate?: ModelTypes["fdp_pdp_aggregate_order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_fundings_aggregate?: ModelTypes["institute_funding_aggregate_order_by"] | undefined,
	landmark?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	pin?: ModelTypes["order_by"] | undefined,
	state?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
	website?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: institute */
["institute_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["institute_select_column"]:institute_select_column;
	/** input type for updating data in table "institute" */
["institute_set_input"]: {
	address?: string | undefined,
	city?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_of_establishment?: ModelTypes["date"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate stddev on columns */
["institute_stddev_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["institute_stddev_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["institute_stddev_samp_fields"]: {
		cursorId?: number | undefined
};
	/** Streaming cursor of the table "institute" */
["institute_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["institute_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["institute_stream_cursor_value_input"]: {
	address?: string | undefined,
	city?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	date_of_establishment?: ModelTypes["date"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	status?: ModelTypes["STATUS_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate sum on columns */
["institute_sum_fields"]: {
		cursorId?: ModelTypes["bigint"] | undefined
};
	["institute_update_column"]:institute_update_column;
	["institute_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["institute_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["institute_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["institute_bool_exp"]
};
	/** aggregate var_pop on columns */
["institute_var_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["institute_var_samp_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate variance on columns */
["institute_variance_fields"]: {
		cursorId?: number | undefined
};
	/** mutation root */
["mutation_root"]: {
		/** delete data from the table: "STATUS" */
	delete_STATUS?: ModelTypes["STATUS_mutation_response"] | undefined,
	/** delete single row from the table: "STATUS" */
	delete_STATUS_by_pk?: ModelTypes["STATUS"] | undefined,
	/** delete data from the table: "e_governance" */
	delete_e_governance?: ModelTypes["e_governance_mutation_response"] | undefined,
	/** delete single row from the table: "e_governance" */
	delete_e_governance_by_pk?: ModelTypes["e_governance"] | undefined,
	/** delete data from the table: "faculty" */
	delete_faculty?: ModelTypes["faculty_mutation_response"] | undefined,
	/** delete single row from the table: "faculty" */
	delete_faculty_by_pk?: ModelTypes["faculty"] | undefined,
	/** delete data from the table: "faculty_funding" */
	delete_faculty_funding?: ModelTypes["faculty_funding_mutation_response"] | undefined,
	/** delete single row from the table: "faculty_funding" */
	delete_faculty_funding_by_pk?: ModelTypes["faculty_funding"] | undefined,
	/** delete data from the table: "fdp_pdp" */
	delete_fdp_pdp?: ModelTypes["fdp_pdp_mutation_response"] | undefined,
	/** delete single row from the table: "fdp_pdp" */
	delete_fdp_pdp_by_pk?: ModelTypes["fdp_pdp"] | undefined,
	/** delete data from the table: "genesis" */
	delete_genesis?: ModelTypes["genesis_mutation_response"] | undefined,
	/** delete single row from the table: "genesis" */
	delete_genesis_by_pk?: ModelTypes["genesis"] | undefined,
	/** delete data from the table: "institute" */
	delete_institute?: ModelTypes["institute_mutation_response"] | undefined,
	/** delete single row from the table: "institute" */
	delete_institute_by_pk?: ModelTypes["institute"] | undefined,
	/** delete data from the table: "institute_funding" */
	delete_institute_funding?: ModelTypes["institute_funding_mutation_response"] | undefined,
	/** delete single row from the table: "institute_funding" */
	delete_institute_funding_by_pk?: ModelTypes["institute_funding"] | undefined,
	/** insert data into the table: "STATUS" */
	insert_STATUS?: ModelTypes["STATUS_mutation_response"] | undefined,
	/** insert a single row into the table: "STATUS" */
	insert_STATUS_one?: ModelTypes["STATUS"] | undefined,
	/** insert data into the table: "e_governance" */
	insert_e_governance?: ModelTypes["e_governance_mutation_response"] | undefined,
	/** insert a single row into the table: "e_governance" */
	insert_e_governance_one?: ModelTypes["e_governance"] | undefined,
	/** insert data into the table: "faculty" */
	insert_faculty?: ModelTypes["faculty_mutation_response"] | undefined,
	/** insert data into the table: "faculty_funding" */
	insert_faculty_funding?: ModelTypes["faculty_funding_mutation_response"] | undefined,
	/** insert a single row into the table: "faculty_funding" */
	insert_faculty_funding_one?: ModelTypes["faculty_funding"] | undefined,
	/** insert a single row into the table: "faculty" */
	insert_faculty_one?: ModelTypes["faculty"] | undefined,
	/** insert data into the table: "fdp_pdp" */
	insert_fdp_pdp?: ModelTypes["fdp_pdp_mutation_response"] | undefined,
	/** insert a single row into the table: "fdp_pdp" */
	insert_fdp_pdp_one?: ModelTypes["fdp_pdp"] | undefined,
	/** insert data into the table: "genesis" */
	insert_genesis?: ModelTypes["genesis_mutation_response"] | undefined,
	/** insert a single row into the table: "genesis" */
	insert_genesis_one?: ModelTypes["genesis"] | undefined,
	/** insert data into the table: "institute" */
	insert_institute?: ModelTypes["institute_mutation_response"] | undefined,
	/** insert data into the table: "institute_funding" */
	insert_institute_funding?: ModelTypes["institute_funding_mutation_response"] | undefined,
	/** insert a single row into the table: "institute_funding" */
	insert_institute_funding_one?: ModelTypes["institute_funding"] | undefined,
	/** insert a single row into the table: "institute" */
	insert_institute_one?: ModelTypes["institute"] | undefined,
	/** update data of the table: "STATUS" */
	update_STATUS?: ModelTypes["STATUS_mutation_response"] | undefined,
	/** update single row of the table: "STATUS" */
	update_STATUS_by_pk?: ModelTypes["STATUS"] | undefined,
	/** update multiples rows of table: "STATUS" */
	update_STATUS_many?: Array<ModelTypes["STATUS_mutation_response"] | undefined> | undefined,
	/** update data of the table: "e_governance" */
	update_e_governance?: ModelTypes["e_governance_mutation_response"] | undefined,
	/** update single row of the table: "e_governance" */
	update_e_governance_by_pk?: ModelTypes["e_governance"] | undefined,
	/** update multiples rows of table: "e_governance" */
	update_e_governance_many?: Array<ModelTypes["e_governance_mutation_response"] | undefined> | undefined,
	/** update data of the table: "faculty" */
	update_faculty?: ModelTypes["faculty_mutation_response"] | undefined,
	/** update single row of the table: "faculty" */
	update_faculty_by_pk?: ModelTypes["faculty"] | undefined,
	/** update data of the table: "faculty_funding" */
	update_faculty_funding?: ModelTypes["faculty_funding_mutation_response"] | undefined,
	/** update single row of the table: "faculty_funding" */
	update_faculty_funding_by_pk?: ModelTypes["faculty_funding"] | undefined,
	/** update multiples rows of table: "faculty_funding" */
	update_faculty_funding_many?: Array<ModelTypes["faculty_funding_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "faculty" */
	update_faculty_many?: Array<ModelTypes["faculty_mutation_response"] | undefined> | undefined,
	/** update data of the table: "fdp_pdp" */
	update_fdp_pdp?: ModelTypes["fdp_pdp_mutation_response"] | undefined,
	/** update single row of the table: "fdp_pdp" */
	update_fdp_pdp_by_pk?: ModelTypes["fdp_pdp"] | undefined,
	/** update multiples rows of table: "fdp_pdp" */
	update_fdp_pdp_many?: Array<ModelTypes["fdp_pdp_mutation_response"] | undefined> | undefined,
	/** update data of the table: "genesis" */
	update_genesis?: ModelTypes["genesis_mutation_response"] | undefined,
	/** update single row of the table: "genesis" */
	update_genesis_by_pk?: ModelTypes["genesis"] | undefined,
	/** update multiples rows of table: "genesis" */
	update_genesis_many?: Array<ModelTypes["genesis_mutation_response"] | undefined> | undefined,
	/** update data of the table: "institute" */
	update_institute?: ModelTypes["institute_mutation_response"] | undefined,
	/** update single row of the table: "institute" */
	update_institute_by_pk?: ModelTypes["institute"] | undefined,
	/** update data of the table: "institute_funding" */
	update_institute_funding?: ModelTypes["institute_funding_mutation_response"] | undefined,
	/** update single row of the table: "institute_funding" */
	update_institute_funding_by_pk?: ModelTypes["institute_funding"] | undefined,
	/** update multiples rows of table: "institute_funding" */
	update_institute_funding_many?: Array<ModelTypes["institute_funding_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "institute" */
	update_institute_many?: Array<ModelTypes["institute_mutation_response"] | undefined> | undefined
};
	["order_by"]:order_by;
	["query_root"]: {
		/** fetch data from the table: "STATUS" */
	STATUS: Array<ModelTypes["STATUS"]>,
	/** fetch aggregated fields from the table: "STATUS" */
	STATUS_aggregate: ModelTypes["STATUS_aggregate"],
	/** fetch data from the table: "STATUS" using primary key columns */
	STATUS_by_pk?: ModelTypes["STATUS"] | undefined,
	/** fetch data from the table: "e_governance" */
	e_governance: Array<ModelTypes["e_governance"]>,
	/** fetch aggregated fields from the table: "e_governance" */
	e_governance_aggregate: ModelTypes["e_governance_aggregate"],
	/** fetch data from the table: "e_governance" using primary key columns */
	e_governance_by_pk?: ModelTypes["e_governance"] | undefined,
	/** fetch data from the table: "faculty" */
	faculty: Array<ModelTypes["faculty"]>,
	/** fetch aggregated fields from the table: "faculty" */
	faculty_aggregate: ModelTypes["faculty_aggregate"],
	/** fetch data from the table: "faculty" using primary key columns */
	faculty_by_pk?: ModelTypes["faculty"] | undefined,
	/** fetch data from the table: "faculty_funding" */
	faculty_funding: Array<ModelTypes["faculty_funding"]>,
	/** fetch aggregated fields from the table: "faculty_funding" */
	faculty_funding_aggregate: ModelTypes["faculty_funding_aggregate"],
	/** fetch data from the table: "faculty_funding" using primary key columns */
	faculty_funding_by_pk?: ModelTypes["faculty_funding"] | undefined,
	/** fetch data from the table: "fdp_pdp" */
	fdp_pdp: Array<ModelTypes["fdp_pdp"]>,
	/** fetch aggregated fields from the table: "fdp_pdp" */
	fdp_pdp_aggregate: ModelTypes["fdp_pdp_aggregate"],
	/** fetch data from the table: "fdp_pdp" using primary key columns */
	fdp_pdp_by_pk?: ModelTypes["fdp_pdp"] | undefined,
	/** fetch data from the table: "genesis" */
	genesis: Array<ModelTypes["genesis"]>,
	/** fetch aggregated fields from the table: "genesis" */
	genesis_aggregate: ModelTypes["genesis_aggregate"],
	/** fetch data from the table: "genesis" using primary key columns */
	genesis_by_pk?: ModelTypes["genesis"] | undefined,
	/** fetch data from the table: "institute" */
	institute: Array<ModelTypes["institute"]>,
	/** fetch aggregated fields from the table: "institute" */
	institute_aggregate: ModelTypes["institute_aggregate"],
	/** fetch data from the table: "institute" using primary key columns */
	institute_by_pk?: ModelTypes["institute"] | undefined,
	/** fetch data from the table: "institute_funding" */
	institute_funding: Array<ModelTypes["institute_funding"]>,
	/** fetch aggregated fields from the table: "institute_funding" */
	institute_funding_aggregate: ModelTypes["institute_funding_aggregate"],
	/** fetch data from the table: "institute_funding" using primary key columns */
	institute_funding_by_pk?: ModelTypes["institute_funding"] | undefined
};
	["subscription_root"]: {
		/** fetch data from the table: "STATUS" */
	STATUS: Array<ModelTypes["STATUS"]>,
	/** fetch aggregated fields from the table: "STATUS" */
	STATUS_aggregate: ModelTypes["STATUS_aggregate"],
	/** fetch data from the table: "STATUS" using primary key columns */
	STATUS_by_pk?: ModelTypes["STATUS"] | undefined,
	/** fetch data from the table in a streaming manner: "STATUS" */
	STATUS_stream: Array<ModelTypes["STATUS"]>,
	/** fetch data from the table: "e_governance" */
	e_governance: Array<ModelTypes["e_governance"]>,
	/** fetch aggregated fields from the table: "e_governance" */
	e_governance_aggregate: ModelTypes["e_governance_aggregate"],
	/** fetch data from the table: "e_governance" using primary key columns */
	e_governance_by_pk?: ModelTypes["e_governance"] | undefined,
	/** fetch data from the table in a streaming manner: "e_governance" */
	e_governance_stream: Array<ModelTypes["e_governance"]>,
	/** fetch data from the table: "faculty" */
	faculty: Array<ModelTypes["faculty"]>,
	/** fetch aggregated fields from the table: "faculty" */
	faculty_aggregate: ModelTypes["faculty_aggregate"],
	/** fetch data from the table: "faculty" using primary key columns */
	faculty_by_pk?: ModelTypes["faculty"] | undefined,
	/** fetch data from the table: "faculty_funding" */
	faculty_funding: Array<ModelTypes["faculty_funding"]>,
	/** fetch aggregated fields from the table: "faculty_funding" */
	faculty_funding_aggregate: ModelTypes["faculty_funding_aggregate"],
	/** fetch data from the table: "faculty_funding" using primary key columns */
	faculty_funding_by_pk?: ModelTypes["faculty_funding"] | undefined,
	/** fetch data from the table in a streaming manner: "faculty_funding" */
	faculty_funding_stream: Array<ModelTypes["faculty_funding"]>,
	/** fetch data from the table in a streaming manner: "faculty" */
	faculty_stream: Array<ModelTypes["faculty"]>,
	/** fetch data from the table: "fdp_pdp" */
	fdp_pdp: Array<ModelTypes["fdp_pdp"]>,
	/** fetch aggregated fields from the table: "fdp_pdp" */
	fdp_pdp_aggregate: ModelTypes["fdp_pdp_aggregate"],
	/** fetch data from the table: "fdp_pdp" using primary key columns */
	fdp_pdp_by_pk?: ModelTypes["fdp_pdp"] | undefined,
	/** fetch data from the table in a streaming manner: "fdp_pdp" */
	fdp_pdp_stream: Array<ModelTypes["fdp_pdp"]>,
	/** fetch data from the table: "genesis" */
	genesis: Array<ModelTypes["genesis"]>,
	/** fetch aggregated fields from the table: "genesis" */
	genesis_aggregate: ModelTypes["genesis_aggregate"],
	/** fetch data from the table: "genesis" using primary key columns */
	genesis_by_pk?: ModelTypes["genesis"] | undefined,
	/** fetch data from the table in a streaming manner: "genesis" */
	genesis_stream: Array<ModelTypes["genesis"]>,
	/** fetch data from the table: "institute" */
	institute: Array<ModelTypes["institute"]>,
	/** fetch aggregated fields from the table: "institute" */
	institute_aggregate: ModelTypes["institute_aggregate"],
	/** fetch data from the table: "institute" using primary key columns */
	institute_by_pk?: ModelTypes["institute"] | undefined,
	/** fetch data from the table: "institute_funding" */
	institute_funding: Array<ModelTypes["institute_funding"]>,
	/** fetch aggregated fields from the table: "institute_funding" */
	institute_funding_aggregate: ModelTypes["institute_funding_aggregate"],
	/** fetch data from the table: "institute_funding" using primary key columns */
	institute_funding_by_pk?: ModelTypes["institute_funding"] | undefined,
	/** fetch data from the table in a streaming manner: "institute_funding" */
	institute_funding_stream: Array<ModelTypes["institute_funding"]>,
	/** fetch data from the table in a streaming manner: "institute" */
	institute_stream: Array<ModelTypes["institute"]>
};
	["timestamptz"]:any;
	/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
["timestamptz_comparison_exp"]: {
	_eq?: ModelTypes["timestamptz"] | undefined,
	_gt?: ModelTypes["timestamptz"] | undefined,
	_gte?: ModelTypes["timestamptz"] | undefined,
	_in?: Array<ModelTypes["timestamptz"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: ModelTypes["timestamptz"] | undefined,
	_lte?: ModelTypes["timestamptz"] | undefined,
	_neq?: ModelTypes["timestamptz"] | undefined,
	_nin?: Array<ModelTypes["timestamptz"]> | undefined
};
	["uuid"]:any;
	/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
["uuid_comparison_exp"]: {
	_eq?: ModelTypes["uuid"] | undefined,
	_gt?: ModelTypes["uuid"] | undefined,
	_gte?: ModelTypes["uuid"] | undefined,
	_in?: Array<ModelTypes["uuid"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: ModelTypes["uuid"] | undefined,
	_lte?: ModelTypes["uuid"] | undefined,
	_neq?: ModelTypes["uuid"] | undefined,
	_nin?: Array<ModelTypes["uuid"]> | undefined
}
    }

export type GraphQLTypes = {
    /** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
["Int_comparison_exp"]: {
		_eq?: number | undefined,
	_gt?: number | undefined,
	_gte?: number | undefined,
	_in?: Array<number> | undefined,
	_is_null?: boolean | undefined,
	_lt?: number | undefined,
	_lte?: number | undefined,
	_neq?: number | undefined,
	_nin?: Array<number> | undefined
};
	/** columns and relationships of "STATUS" */
["STATUS"]: {
	__typename: "STATUS",
	value: string
};
	/** aggregated selection of "STATUS" */
["STATUS_aggregate"]: {
	__typename: "STATUS_aggregate",
	aggregate?: GraphQLTypes["STATUS_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["STATUS"]>
};
	/** aggregate fields of "STATUS" */
["STATUS_aggregate_fields"]: {
	__typename: "STATUS_aggregate_fields",
	count: number,
	max?: GraphQLTypes["STATUS_max_fields"] | undefined,
	min?: GraphQLTypes["STATUS_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "STATUS". All fields are combined with a logical 'AND'. */
["STATUS_bool_exp"]: {
		_and?: Array<GraphQLTypes["STATUS_bool_exp"]> | undefined,
	_not?: GraphQLTypes["STATUS_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["STATUS_bool_exp"]> | undefined,
	value?: GraphQLTypes["String_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "STATUS" */
["STATUS_constraint"]: STATUS_constraint;
	["STATUS_enum"]: STATUS_enum;
	/** Boolean expression to compare columns of type "STATUS_enum". All fields are combined with logical 'AND'. */
["STATUS_enum_comparison_exp"]: {
		_eq?: GraphQLTypes["STATUS_enum"] | undefined,
	_in?: Array<GraphQLTypes["STATUS_enum"]> | undefined,
	_is_null?: boolean | undefined,
	_neq?: GraphQLTypes["STATUS_enum"] | undefined,
	_nin?: Array<GraphQLTypes["STATUS_enum"]> | undefined
};
	/** input type for inserting data into table "STATUS" */
["STATUS_insert_input"]: {
		value?: string | undefined
};
	/** aggregate max on columns */
["STATUS_max_fields"]: {
	__typename: "STATUS_max_fields",
	value?: string | undefined
};
	/** aggregate min on columns */
["STATUS_min_fields"]: {
	__typename: "STATUS_min_fields",
	value?: string | undefined
};
	/** response of any mutation on the table "STATUS" */
["STATUS_mutation_response"]: {
	__typename: "STATUS_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["STATUS"]>
};
	/** on_conflict condition type for table "STATUS" */
["STATUS_on_conflict"]: {
		constraint: GraphQLTypes["STATUS_constraint"],
	update_columns: Array<GraphQLTypes["STATUS_update_column"]>,
	where?: GraphQLTypes["STATUS_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "STATUS". */
["STATUS_order_by"]: {
		value?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: STATUS */
["STATUS_pk_columns_input"]: {
		value: string
};
	/** select columns of table "STATUS" */
["STATUS_select_column"]: STATUS_select_column;
	/** input type for updating data in table "STATUS" */
["STATUS_set_input"]: {
		value?: string | undefined
};
	/** Streaming cursor of the table "STATUS" */
["STATUS_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["STATUS_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["STATUS_stream_cursor_value_input"]: {
		value?: string | undefined
};
	/** update columns of table "STATUS" */
["STATUS_update_column"]: STATUS_update_column;
	["STATUS_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["STATUS_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["STATUS_bool_exp"]
};
	/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
["String_comparison_exp"]: {
		_eq?: string | undefined,
	_gt?: string | undefined,
	_gte?: string | undefined,
	/** does the column match the given case-insensitive pattern */
	_ilike?: string | undefined,
	_in?: Array<string> | undefined,
	/** does the column match the given POSIX regular expression, case insensitive */
	_iregex?: string | undefined,
	_is_null?: boolean | undefined,
	/** does the column match the given pattern */
	_like?: string | undefined,
	_lt?: string | undefined,
	_lte?: string | undefined,
	_neq?: string | undefined,
	/** does the column NOT match the given case-insensitive pattern */
	_nilike?: string | undefined,
	_nin?: Array<string> | undefined,
	/** does the column NOT match the given POSIX regular expression, case insensitive */
	_niregex?: string | undefined,
	/** does the column NOT match the given pattern */
	_nlike?: string | undefined,
	/** does the column NOT match the given POSIX regular expression, case sensitive */
	_nregex?: string | undefined,
	/** does the column NOT match the given SQL regular expression */
	_nsimilar?: string | undefined,
	/** does the column match the given POSIX regular expression, case sensitive */
	_regex?: string | undefined,
	/** does the column match the given SQL regular expression */
	_similar?: string | undefined
};
	["bigint"]: "scalar" & { name: "bigint" };
	/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
["bigint_comparison_exp"]: {
		_eq?: GraphQLTypes["bigint"] | undefined,
	_gt?: GraphQLTypes["bigint"] | undefined,
	_gte?: GraphQLTypes["bigint"] | undefined,
	_in?: Array<GraphQLTypes["bigint"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: GraphQLTypes["bigint"] | undefined,
	_lte?: GraphQLTypes["bigint"] | undefined,
	_neq?: GraphQLTypes["bigint"] | undefined,
	_nin?: Array<GraphQLTypes["bigint"]> | undefined
};
	/** ordering argument of a cursor */
["cursor_ordering"]: cursor_ordering;
	["date"]: "scalar" & { name: "date" };
	/** Boolean expression to compare columns of type "date". All fields are combined with logical 'AND'. */
["date_comparison_exp"]: {
		_eq?: GraphQLTypes["date"] | undefined,
	_gt?: GraphQLTypes["date"] | undefined,
	_gte?: GraphQLTypes["date"] | undefined,
	_in?: Array<GraphQLTypes["date"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: GraphQLTypes["date"] | undefined,
	_lte?: GraphQLTypes["date"] | undefined,
	_neq?: GraphQLTypes["date"] | undefined,
	_nin?: Array<GraphQLTypes["date"]> | undefined
};
	/** columns and relationships of "e_governance" */
["e_governance"]: {
	__typename: "e_governance",
	address: string,
	area: string,
	createdAt: GraphQLTypes["timestamptz"],
	createdById: GraphQLTypes["uuid"],
	cursorId: GraphQLTypes["bigint"],
	description: string,
	file: string,
	id: GraphQLTypes["uuid"],
	/** An object relationship */
	institute: GraphQLTypes["institute"],
	institute_id: GraphQLTypes["uuid"],
	name: string,
	phone_no: string,
	service_end_date: GraphQLTypes["date"],
	service_start_date: GraphQLTypes["date"],
	status: GraphQLTypes["STATUS_enum"],
	total_amount: string,
	updatedAt: GraphQLTypes["timestamptz"],
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website: string
};
	/** aggregated selection of "e_governance" */
["e_governance_aggregate"]: {
	__typename: "e_governance_aggregate",
	aggregate?: GraphQLTypes["e_governance_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["e_governance"]>
};
	["e_governance_aggregate_bool_exp"]: {
		count?: GraphQLTypes["e_governance_aggregate_bool_exp_count"] | undefined
};
	["e_governance_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["e_governance_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["e_governance_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "e_governance" */
["e_governance_aggregate_fields"]: {
	__typename: "e_governance_aggregate_fields",
	avg?: GraphQLTypes["e_governance_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["e_governance_max_fields"] | undefined,
	min?: GraphQLTypes["e_governance_min_fields"] | undefined,
	stddev?: GraphQLTypes["e_governance_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["e_governance_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["e_governance_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["e_governance_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["e_governance_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["e_governance_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["e_governance_variance_fields"] | undefined
};
	/** order by aggregate values of table "e_governance" */
["e_governance_aggregate_order_by"]: {
		avg?: GraphQLTypes["e_governance_avg_order_by"] | undefined,
	count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["e_governance_max_order_by"] | undefined,
	min?: GraphQLTypes["e_governance_min_order_by"] | undefined,
	stddev?: GraphQLTypes["e_governance_stddev_order_by"] | undefined,
	stddev_pop?: GraphQLTypes["e_governance_stddev_pop_order_by"] | undefined,
	stddev_samp?: GraphQLTypes["e_governance_stddev_samp_order_by"] | undefined,
	sum?: GraphQLTypes["e_governance_sum_order_by"] | undefined,
	var_pop?: GraphQLTypes["e_governance_var_pop_order_by"] | undefined,
	var_samp?: GraphQLTypes["e_governance_var_samp_order_by"] | undefined,
	variance?: GraphQLTypes["e_governance_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "e_governance" */
["e_governance_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["e_governance_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["e_governance_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["e_governance_avg_fields"]: {
	__typename: "e_governance_avg_fields",
	cursorId?: number | undefined
};
	/** order by avg() on columns of table "e_governance" */
["e_governance_avg_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "e_governance". All fields are combined with a logical 'AND'. */
["e_governance_bool_exp"]: {
		_and?: Array<GraphQLTypes["e_governance_bool_exp"]> | undefined,
	_not?: GraphQLTypes["e_governance_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["e_governance_bool_exp"]> | undefined,
	address?: GraphQLTypes["String_comparison_exp"] | undefined,
	area?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	description?: GraphQLTypes["String_comparison_exp"] | undefined,
	file?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	institute?: GraphQLTypes["institute_bool_exp"] | undefined,
	institute_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	phone_no?: GraphQLTypes["String_comparison_exp"] | undefined,
	service_end_date?: GraphQLTypes["date_comparison_exp"] | undefined,
	service_start_date?: GraphQLTypes["date_comparison_exp"] | undefined,
	status?: GraphQLTypes["STATUS_enum_comparison_exp"] | undefined,
	total_amount?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	website?: GraphQLTypes["String_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "e_governance" */
["e_governance_constraint"]: e_governance_constraint;
	/** input type for incrementing numeric columns in table "e_governance" */
["e_governance_inc_input"]: {
		cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "e_governance" */
["e_governance_insert_input"]: {
		address?: string | undefined,
	area?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute?: GraphQLTypes["institute_obj_rel_insert_input"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: GraphQLTypes["date"] | undefined,
	service_start_date?: GraphQLTypes["date"] | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	total_amount?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate max on columns */
["e_governance_max_fields"]: {
	__typename: "e_governance_max_fields",
	address?: string | undefined,
	area?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: GraphQLTypes["date"] | undefined,
	service_start_date?: GraphQLTypes["date"] | undefined,
	total_amount?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** order by max() on columns of table "e_governance" */
["e_governance_max_order_by"]: {
		address?: GraphQLTypes["order_by"] | undefined,
	area?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	description?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	phone_no?: GraphQLTypes["order_by"] | undefined,
	service_end_date?: GraphQLTypes["order_by"] | undefined,
	service_start_date?: GraphQLTypes["order_by"] | undefined,
	total_amount?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
	website?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["e_governance_min_fields"]: {
	__typename: "e_governance_min_fields",
	address?: string | undefined,
	area?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: GraphQLTypes["date"] | undefined,
	service_start_date?: GraphQLTypes["date"] | undefined,
	total_amount?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** order by min() on columns of table "e_governance" */
["e_governance_min_order_by"]: {
		address?: GraphQLTypes["order_by"] | undefined,
	area?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	description?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	phone_no?: GraphQLTypes["order_by"] | undefined,
	service_end_date?: GraphQLTypes["order_by"] | undefined,
	service_start_date?: GraphQLTypes["order_by"] | undefined,
	total_amount?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
	website?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "e_governance" */
["e_governance_mutation_response"]: {
	__typename: "e_governance_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["e_governance"]>
};
	/** on_conflict condition type for table "e_governance" */
["e_governance_on_conflict"]: {
		constraint: GraphQLTypes["e_governance_constraint"],
	update_columns: Array<GraphQLTypes["e_governance_update_column"]>,
	where?: GraphQLTypes["e_governance_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "e_governance". */
["e_governance_order_by"]: {
		address?: GraphQLTypes["order_by"] | undefined,
	area?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	description?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute?: GraphQLTypes["institute_order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	phone_no?: GraphQLTypes["order_by"] | undefined,
	service_end_date?: GraphQLTypes["order_by"] | undefined,
	service_start_date?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	total_amount?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
	website?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: e_governance */
["e_governance_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "e_governance" */
["e_governance_select_column"]: e_governance_select_column;
	/** input type for updating data in table "e_governance" */
["e_governance_set_input"]: {
		address?: string | undefined,
	area?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: GraphQLTypes["date"] | undefined,
	service_start_date?: GraphQLTypes["date"] | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	total_amount?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate stddev on columns */
["e_governance_stddev_fields"]: {
	__typename: "e_governance_stddev_fields",
	cursorId?: number | undefined
};
	/** order by stddev() on columns of table "e_governance" */
["e_governance_stddev_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["e_governance_stddev_pop_fields"]: {
	__typename: "e_governance_stddev_pop_fields",
	cursorId?: number | undefined
};
	/** order by stddev_pop() on columns of table "e_governance" */
["e_governance_stddev_pop_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["e_governance_stddev_samp_fields"]: {
	__typename: "e_governance_stddev_samp_fields",
	cursorId?: number | undefined
};
	/** order by stddev_samp() on columns of table "e_governance" */
["e_governance_stddev_samp_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "e_governance" */
["e_governance_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["e_governance_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["e_governance_stream_cursor_value_input"]: {
		address?: string | undefined,
	area?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: GraphQLTypes["date"] | undefined,
	service_start_date?: GraphQLTypes["date"] | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	total_amount?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate sum on columns */
["e_governance_sum_fields"]: {
	__typename: "e_governance_sum_fields",
	cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** order by sum() on columns of table "e_governance" */
["e_governance_sum_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** update columns of table "e_governance" */
["e_governance_update_column"]: e_governance_update_column;
	["e_governance_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["e_governance_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["e_governance_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["e_governance_bool_exp"]
};
	/** aggregate var_pop on columns */
["e_governance_var_pop_fields"]: {
	__typename: "e_governance_var_pop_fields",
	cursorId?: number | undefined
};
	/** order by var_pop() on columns of table "e_governance" */
["e_governance_var_pop_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["e_governance_var_samp_fields"]: {
	__typename: "e_governance_var_samp_fields",
	cursorId?: number | undefined
};
	/** order by var_samp() on columns of table "e_governance" */
["e_governance_var_samp_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["e_governance_variance_fields"]: {
	__typename: "e_governance_variance_fields",
	cursorId?: number | undefined
};
	/** order by variance() on columns of table "e_governance" */
["e_governance_variance_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** columns and relationships of "faculty" */
["faculty"]: {
	__typename: "faculty",
	address?: string | undefined,
	cast?: string | undefined,
	createdAt: GraphQLTypes["timestamptz"],
	createdById: GraphQLTypes["uuid"],
	cursorId: GraphQLTypes["bigint"],
	date_of_joining: GraphQLTypes["date"],
	designation: string,
	dob?: GraphQLTypes["date"] | undefined,
	email_id: string,
	experience: string,
	/** An array relationship */
	faculty_fundings: Array<GraphQLTypes["faculty_funding"]>,
	/** An aggregate relationship */
	faculty_fundings_aggregate: GraphQLTypes["faculty_funding_aggregate"],
	/** An array relationship */
	fdp_pdps: Array<GraphQLTypes["fdp_pdp"]>,
	/** An aggregate relationship */
	fdp_pdps_aggregate: GraphQLTypes["fdp_pdp_aggregate"],
	gender: string,
	id: GraphQLTypes["uuid"],
	/** An object relationship */
	institute: GraphQLTypes["institute"],
	institute_id: GraphQLTypes["uuid"],
	job_type: string,
	minority?: string | undefined,
	name: string,
	pan_card_no?: string | undefined,
	phone: string,
	qualification: string,
	section?: string | undefined,
	staff_type: string,
	status: GraphQLTypes["STATUS_enum"],
	status_of_approval: string,
	updatedAt: GraphQLTypes["timestamptz"],
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregated selection of "faculty" */
["faculty_aggregate"]: {
	__typename: "faculty_aggregate",
	aggregate?: GraphQLTypes["faculty_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["faculty"]>
};
	["faculty_aggregate_bool_exp"]: {
		count?: GraphQLTypes["faculty_aggregate_bool_exp_count"] | undefined
};
	["faculty_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["faculty_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["faculty_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "faculty" */
["faculty_aggregate_fields"]: {
	__typename: "faculty_aggregate_fields",
	avg?: GraphQLTypes["faculty_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["faculty_max_fields"] | undefined,
	min?: GraphQLTypes["faculty_min_fields"] | undefined,
	stddev?: GraphQLTypes["faculty_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["faculty_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["faculty_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["faculty_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["faculty_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["faculty_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["faculty_variance_fields"] | undefined
};
	/** order by aggregate values of table "faculty" */
["faculty_aggregate_order_by"]: {
		avg?: GraphQLTypes["faculty_avg_order_by"] | undefined,
	count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["faculty_max_order_by"] | undefined,
	min?: GraphQLTypes["faculty_min_order_by"] | undefined,
	stddev?: GraphQLTypes["faculty_stddev_order_by"] | undefined,
	stddev_pop?: GraphQLTypes["faculty_stddev_pop_order_by"] | undefined,
	stddev_samp?: GraphQLTypes["faculty_stddev_samp_order_by"] | undefined,
	sum?: GraphQLTypes["faculty_sum_order_by"] | undefined,
	var_pop?: GraphQLTypes["faculty_var_pop_order_by"] | undefined,
	var_samp?: GraphQLTypes["faculty_var_samp_order_by"] | undefined,
	variance?: GraphQLTypes["faculty_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "faculty" */
["faculty_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["faculty_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["faculty_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["faculty_avg_fields"]: {
	__typename: "faculty_avg_fields",
	cursorId?: number | undefined
};
	/** order by avg() on columns of table "faculty" */
["faculty_avg_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "faculty". All fields are combined with a logical 'AND'. */
["faculty_bool_exp"]: {
		_and?: Array<GraphQLTypes["faculty_bool_exp"]> | undefined,
	_not?: GraphQLTypes["faculty_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["faculty_bool_exp"]> | undefined,
	address?: GraphQLTypes["String_comparison_exp"] | undefined,
	cast?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	date_of_joining?: GraphQLTypes["date_comparison_exp"] | undefined,
	designation?: GraphQLTypes["String_comparison_exp"] | undefined,
	dob?: GraphQLTypes["date_comparison_exp"] | undefined,
	email_id?: GraphQLTypes["String_comparison_exp"] | undefined,
	experience?: GraphQLTypes["String_comparison_exp"] | undefined,
	faculty_fundings?: GraphQLTypes["faculty_funding_bool_exp"] | undefined,
	faculty_fundings_aggregate?: GraphQLTypes["faculty_funding_aggregate_bool_exp"] | undefined,
	fdp_pdps?: GraphQLTypes["fdp_pdp_bool_exp"] | undefined,
	fdp_pdps_aggregate?: GraphQLTypes["fdp_pdp_aggregate_bool_exp"] | undefined,
	gender?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	institute?: GraphQLTypes["institute_bool_exp"] | undefined,
	institute_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	job_type?: GraphQLTypes["String_comparison_exp"] | undefined,
	minority?: GraphQLTypes["String_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	pan_card_no?: GraphQLTypes["String_comparison_exp"] | undefined,
	phone?: GraphQLTypes["String_comparison_exp"] | undefined,
	qualification?: GraphQLTypes["String_comparison_exp"] | undefined,
	section?: GraphQLTypes["String_comparison_exp"] | undefined,
	staff_type?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["STATUS_enum_comparison_exp"] | undefined,
	status_of_approval?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "faculty" */
["faculty_constraint"]: faculty_constraint;
	/** columns and relationships of "faculty_funding" */
["faculty_funding"]: {
	__typename: "faculty_funding",
	amount: string,
	createdAt: GraphQLTypes["timestamptz"],
	createdById: GraphQLTypes["uuid"],
	cursorId: GraphQLTypes["bigint"],
	/** An object relationship */
	faculty: GraphQLTypes["faculty"],
	faculty_id: GraphQLTypes["uuid"],
	file: string,
	id: GraphQLTypes["uuid"],
	/** An object relationship */
	institute: GraphQLTypes["institute"],
	institute_id: GraphQLTypes["uuid"],
	nature: string,
	status: GraphQLTypes["STATUS_enum"],
	transaction_date: GraphQLTypes["date"],
	transaction_type: string,
	type: string,
	updatedAt: GraphQLTypes["timestamptz"],
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregated selection of "faculty_funding" */
["faculty_funding_aggregate"]: {
	__typename: "faculty_funding_aggregate",
	aggregate?: GraphQLTypes["faculty_funding_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["faculty_funding"]>
};
	["faculty_funding_aggregate_bool_exp"]: {
		count?: GraphQLTypes["faculty_funding_aggregate_bool_exp_count"] | undefined
};
	["faculty_funding_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["faculty_funding_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["faculty_funding_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "faculty_funding" */
["faculty_funding_aggregate_fields"]: {
	__typename: "faculty_funding_aggregate_fields",
	avg?: GraphQLTypes["faculty_funding_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["faculty_funding_max_fields"] | undefined,
	min?: GraphQLTypes["faculty_funding_min_fields"] | undefined,
	stddev?: GraphQLTypes["faculty_funding_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["faculty_funding_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["faculty_funding_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["faculty_funding_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["faculty_funding_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["faculty_funding_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["faculty_funding_variance_fields"] | undefined
};
	/** order by aggregate values of table "faculty_funding" */
["faculty_funding_aggregate_order_by"]: {
		avg?: GraphQLTypes["faculty_funding_avg_order_by"] | undefined,
	count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["faculty_funding_max_order_by"] | undefined,
	min?: GraphQLTypes["faculty_funding_min_order_by"] | undefined,
	stddev?: GraphQLTypes["faculty_funding_stddev_order_by"] | undefined,
	stddev_pop?: GraphQLTypes["faculty_funding_stddev_pop_order_by"] | undefined,
	stddev_samp?: GraphQLTypes["faculty_funding_stddev_samp_order_by"] | undefined,
	sum?: GraphQLTypes["faculty_funding_sum_order_by"] | undefined,
	var_pop?: GraphQLTypes["faculty_funding_var_pop_order_by"] | undefined,
	var_samp?: GraphQLTypes["faculty_funding_var_samp_order_by"] | undefined,
	variance?: GraphQLTypes["faculty_funding_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "faculty_funding" */
["faculty_funding_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["faculty_funding_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["faculty_funding_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["faculty_funding_avg_fields"]: {
	__typename: "faculty_funding_avg_fields",
	cursorId?: number | undefined
};
	/** order by avg() on columns of table "faculty_funding" */
["faculty_funding_avg_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "faculty_funding". All fields are combined with a logical 'AND'. */
["faculty_funding_bool_exp"]: {
		_and?: Array<GraphQLTypes["faculty_funding_bool_exp"]> | undefined,
	_not?: GraphQLTypes["faculty_funding_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["faculty_funding_bool_exp"]> | undefined,
	amount?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	faculty?: GraphQLTypes["faculty_bool_exp"] | undefined,
	faculty_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	file?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	institute?: GraphQLTypes["institute_bool_exp"] | undefined,
	institute_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	nature?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["STATUS_enum_comparison_exp"] | undefined,
	transaction_date?: GraphQLTypes["date_comparison_exp"] | undefined,
	transaction_type?: GraphQLTypes["String_comparison_exp"] | undefined,
	type?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "faculty_funding" */
["faculty_funding_constraint"]: faculty_funding_constraint;
	/** input type for incrementing numeric columns in table "faculty_funding" */
["faculty_funding_inc_input"]: {
		cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "faculty_funding" */
["faculty_funding_insert_input"]: {
		amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	faculty?: GraphQLTypes["faculty_obj_rel_insert_input"] | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute?: GraphQLTypes["institute_obj_rel_insert_input"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["faculty_funding_max_fields"]: {
	__typename: "faculty_funding_max_fields",
	amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** order by max() on columns of table "faculty_funding" */
["faculty_funding_max_order_by"]: {
		amount?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	faculty_id?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	nature?: GraphQLTypes["order_by"] | undefined,
	transaction_date?: GraphQLTypes["order_by"] | undefined,
	transaction_type?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["faculty_funding_min_fields"]: {
	__typename: "faculty_funding_min_fields",
	amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** order by min() on columns of table "faculty_funding" */
["faculty_funding_min_order_by"]: {
		amount?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	faculty_id?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	nature?: GraphQLTypes["order_by"] | undefined,
	transaction_date?: GraphQLTypes["order_by"] | undefined,
	transaction_type?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "faculty_funding" */
["faculty_funding_mutation_response"]: {
	__typename: "faculty_funding_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["faculty_funding"]>
};
	/** on_conflict condition type for table "faculty_funding" */
["faculty_funding_on_conflict"]: {
		constraint: GraphQLTypes["faculty_funding_constraint"],
	update_columns: Array<GraphQLTypes["faculty_funding_update_column"]>,
	where?: GraphQLTypes["faculty_funding_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "faculty_funding". */
["faculty_funding_order_by"]: {
		amount?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	faculty?: GraphQLTypes["faculty_order_by"] | undefined,
	faculty_id?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute?: GraphQLTypes["institute_order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	nature?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	transaction_date?: GraphQLTypes["order_by"] | undefined,
	transaction_type?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: faculty_funding */
["faculty_funding_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "faculty_funding" */
["faculty_funding_select_column"]: faculty_funding_select_column;
	/** input type for updating data in table "faculty_funding" */
["faculty_funding_set_input"]: {
		amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["faculty_funding_stddev_fields"]: {
	__typename: "faculty_funding_stddev_fields",
	cursorId?: number | undefined
};
	/** order by stddev() on columns of table "faculty_funding" */
["faculty_funding_stddev_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["faculty_funding_stddev_pop_fields"]: {
	__typename: "faculty_funding_stddev_pop_fields",
	cursorId?: number | undefined
};
	/** order by stddev_pop() on columns of table "faculty_funding" */
["faculty_funding_stddev_pop_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["faculty_funding_stddev_samp_fields"]: {
	__typename: "faculty_funding_stddev_samp_fields",
	cursorId?: number | undefined
};
	/** order by stddev_samp() on columns of table "faculty_funding" */
["faculty_funding_stddev_samp_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "faculty_funding" */
["faculty_funding_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["faculty_funding_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["faculty_funding_stream_cursor_value_input"]: {
		amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["faculty_funding_sum_fields"]: {
	__typename: "faculty_funding_sum_fields",
	cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** order by sum() on columns of table "faculty_funding" */
["faculty_funding_sum_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** update columns of table "faculty_funding" */
["faculty_funding_update_column"]: faculty_funding_update_column;
	["faculty_funding_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["faculty_funding_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["faculty_funding_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["faculty_funding_bool_exp"]
};
	/** aggregate var_pop on columns */
["faculty_funding_var_pop_fields"]: {
	__typename: "faculty_funding_var_pop_fields",
	cursorId?: number | undefined
};
	/** order by var_pop() on columns of table "faculty_funding" */
["faculty_funding_var_pop_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["faculty_funding_var_samp_fields"]: {
	__typename: "faculty_funding_var_samp_fields",
	cursorId?: number | undefined
};
	/** order by var_samp() on columns of table "faculty_funding" */
["faculty_funding_var_samp_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["faculty_funding_variance_fields"]: {
	__typename: "faculty_funding_variance_fields",
	cursorId?: number | undefined
};
	/** order by variance() on columns of table "faculty_funding" */
["faculty_funding_variance_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** input type for incrementing numeric columns in table "faculty" */
["faculty_inc_input"]: {
		cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "faculty" */
["faculty_insert_input"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_of_joining?: GraphQLTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: GraphQLTypes["date"] | undefined,
	email_id?: string | undefined,
	experience?: string | undefined,
	faculty_fundings?: GraphQLTypes["faculty_funding_arr_rel_insert_input"] | undefined,
	fdp_pdps?: GraphQLTypes["fdp_pdp_arr_rel_insert_input"] | undefined,
	gender?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute?: GraphQLTypes["institute_obj_rel_insert_input"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	job_type?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	pan_card_no?: string | undefined,
	phone?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staff_type?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	status_of_approval?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["faculty_max_fields"]: {
	__typename: "faculty_max_fields",
	address?: string | undefined,
	cast?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_of_joining?: GraphQLTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: GraphQLTypes["date"] | undefined,
	email_id?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	job_type?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	pan_card_no?: string | undefined,
	phone?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staff_type?: string | undefined,
	status_of_approval?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** order by max() on columns of table "faculty" */
["faculty_max_order_by"]: {
		address?: GraphQLTypes["order_by"] | undefined,
	cast?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	date_of_joining?: GraphQLTypes["order_by"] | undefined,
	designation?: GraphQLTypes["order_by"] | undefined,
	dob?: GraphQLTypes["order_by"] | undefined,
	email_id?: GraphQLTypes["order_by"] | undefined,
	experience?: GraphQLTypes["order_by"] | undefined,
	gender?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	job_type?: GraphQLTypes["order_by"] | undefined,
	minority?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	pan_card_no?: GraphQLTypes["order_by"] | undefined,
	phone?: GraphQLTypes["order_by"] | undefined,
	qualification?: GraphQLTypes["order_by"] | undefined,
	section?: GraphQLTypes["order_by"] | undefined,
	staff_type?: GraphQLTypes["order_by"] | undefined,
	status_of_approval?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["faculty_min_fields"]: {
	__typename: "faculty_min_fields",
	address?: string | undefined,
	cast?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_of_joining?: GraphQLTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: GraphQLTypes["date"] | undefined,
	email_id?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	job_type?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	pan_card_no?: string | undefined,
	phone?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staff_type?: string | undefined,
	status_of_approval?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** order by min() on columns of table "faculty" */
["faculty_min_order_by"]: {
		address?: GraphQLTypes["order_by"] | undefined,
	cast?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	date_of_joining?: GraphQLTypes["order_by"] | undefined,
	designation?: GraphQLTypes["order_by"] | undefined,
	dob?: GraphQLTypes["order_by"] | undefined,
	email_id?: GraphQLTypes["order_by"] | undefined,
	experience?: GraphQLTypes["order_by"] | undefined,
	gender?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	job_type?: GraphQLTypes["order_by"] | undefined,
	minority?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	pan_card_no?: GraphQLTypes["order_by"] | undefined,
	phone?: GraphQLTypes["order_by"] | undefined,
	qualification?: GraphQLTypes["order_by"] | undefined,
	section?: GraphQLTypes["order_by"] | undefined,
	staff_type?: GraphQLTypes["order_by"] | undefined,
	status_of_approval?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "faculty" */
["faculty_mutation_response"]: {
	__typename: "faculty_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["faculty"]>
};
	/** input type for inserting object relation for remote table "faculty" */
["faculty_obj_rel_insert_input"]: {
		data: GraphQLTypes["faculty_insert_input"],
	/** upsert condition */
	on_conflict?: GraphQLTypes["faculty_on_conflict"] | undefined
};
	/** on_conflict condition type for table "faculty" */
["faculty_on_conflict"]: {
		constraint: GraphQLTypes["faculty_constraint"],
	update_columns: Array<GraphQLTypes["faculty_update_column"]>,
	where?: GraphQLTypes["faculty_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "faculty". */
["faculty_order_by"]: {
		address?: GraphQLTypes["order_by"] | undefined,
	cast?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	date_of_joining?: GraphQLTypes["order_by"] | undefined,
	designation?: GraphQLTypes["order_by"] | undefined,
	dob?: GraphQLTypes["order_by"] | undefined,
	email_id?: GraphQLTypes["order_by"] | undefined,
	experience?: GraphQLTypes["order_by"] | undefined,
	faculty_fundings_aggregate?: GraphQLTypes["faculty_funding_aggregate_order_by"] | undefined,
	fdp_pdps_aggregate?: GraphQLTypes["fdp_pdp_aggregate_order_by"] | undefined,
	gender?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute?: GraphQLTypes["institute_order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	job_type?: GraphQLTypes["order_by"] | undefined,
	minority?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	pan_card_no?: GraphQLTypes["order_by"] | undefined,
	phone?: GraphQLTypes["order_by"] | undefined,
	qualification?: GraphQLTypes["order_by"] | undefined,
	section?: GraphQLTypes["order_by"] | undefined,
	staff_type?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	status_of_approval?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: faculty */
["faculty_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "faculty" */
["faculty_select_column"]: faculty_select_column;
	/** input type for updating data in table "faculty" */
["faculty_set_input"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_of_joining?: GraphQLTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: GraphQLTypes["date"] | undefined,
	email_id?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	job_type?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	pan_card_no?: string | undefined,
	phone?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staff_type?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	status_of_approval?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["faculty_stddev_fields"]: {
	__typename: "faculty_stddev_fields",
	cursorId?: number | undefined
};
	/** order by stddev() on columns of table "faculty" */
["faculty_stddev_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["faculty_stddev_pop_fields"]: {
	__typename: "faculty_stddev_pop_fields",
	cursorId?: number | undefined
};
	/** order by stddev_pop() on columns of table "faculty" */
["faculty_stddev_pop_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["faculty_stddev_samp_fields"]: {
	__typename: "faculty_stddev_samp_fields",
	cursorId?: number | undefined
};
	/** order by stddev_samp() on columns of table "faculty" */
["faculty_stddev_samp_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "faculty" */
["faculty_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["faculty_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["faculty_stream_cursor_value_input"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_of_joining?: GraphQLTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: GraphQLTypes["date"] | undefined,
	email_id?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	job_type?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	pan_card_no?: string | undefined,
	phone?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staff_type?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	status_of_approval?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["faculty_sum_fields"]: {
	__typename: "faculty_sum_fields",
	cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** order by sum() on columns of table "faculty" */
["faculty_sum_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** update columns of table "faculty" */
["faculty_update_column"]: faculty_update_column;
	["faculty_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["faculty_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["faculty_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["faculty_bool_exp"]
};
	/** aggregate var_pop on columns */
["faculty_var_pop_fields"]: {
	__typename: "faculty_var_pop_fields",
	cursorId?: number | undefined
};
	/** order by var_pop() on columns of table "faculty" */
["faculty_var_pop_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["faculty_var_samp_fields"]: {
	__typename: "faculty_var_samp_fields",
	cursorId?: number | undefined
};
	/** order by var_samp() on columns of table "faculty" */
["faculty_var_samp_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["faculty_variance_fields"]: {
	__typename: "faculty_variance_fields",
	cursorId?: number | undefined
};
	/** order by variance() on columns of table "faculty" */
["faculty_variance_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** columns and relationships of "fdp_pdp" */
["fdp_pdp"]: {
	__typename: "fdp_pdp",
	createdAt: GraphQLTypes["timestamptz"],
	createdById: GraphQLTypes["uuid"],
	cursorId: GraphQLTypes["bigint"],
	date_from: GraphQLTypes["date"],
	date_to: GraphQLTypes["date"],
	description: string,
	/** An object relationship */
	faculty: GraphQLTypes["faculty"],
	faculty_id: GraphQLTypes["uuid"],
	file: string,
	id: GraphQLTypes["uuid"],
	/** An object relationship */
	institute: GraphQLTypes["institute"],
	institute_id: GraphQLTypes["uuid"],
	name: string,
	nature: string,
	status: GraphQLTypes["STATUS_enum"],
	type: string,
	updatedAt: GraphQLTypes["timestamptz"],
	updatedById?: GraphQLTypes["uuid"] | undefined,
	venue: string
};
	/** aggregated selection of "fdp_pdp" */
["fdp_pdp_aggregate"]: {
	__typename: "fdp_pdp_aggregate",
	aggregate?: GraphQLTypes["fdp_pdp_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["fdp_pdp"]>
};
	["fdp_pdp_aggregate_bool_exp"]: {
		count?: GraphQLTypes["fdp_pdp_aggregate_bool_exp_count"] | undefined
};
	["fdp_pdp_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["fdp_pdp_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["fdp_pdp_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "fdp_pdp" */
["fdp_pdp_aggregate_fields"]: {
	__typename: "fdp_pdp_aggregate_fields",
	avg?: GraphQLTypes["fdp_pdp_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["fdp_pdp_max_fields"] | undefined,
	min?: GraphQLTypes["fdp_pdp_min_fields"] | undefined,
	stddev?: GraphQLTypes["fdp_pdp_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["fdp_pdp_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["fdp_pdp_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["fdp_pdp_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["fdp_pdp_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["fdp_pdp_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["fdp_pdp_variance_fields"] | undefined
};
	/** order by aggregate values of table "fdp_pdp" */
["fdp_pdp_aggregate_order_by"]: {
		avg?: GraphQLTypes["fdp_pdp_avg_order_by"] | undefined,
	count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["fdp_pdp_max_order_by"] | undefined,
	min?: GraphQLTypes["fdp_pdp_min_order_by"] | undefined,
	stddev?: GraphQLTypes["fdp_pdp_stddev_order_by"] | undefined,
	stddev_pop?: GraphQLTypes["fdp_pdp_stddev_pop_order_by"] | undefined,
	stddev_samp?: GraphQLTypes["fdp_pdp_stddev_samp_order_by"] | undefined,
	sum?: GraphQLTypes["fdp_pdp_sum_order_by"] | undefined,
	var_pop?: GraphQLTypes["fdp_pdp_var_pop_order_by"] | undefined,
	var_samp?: GraphQLTypes["fdp_pdp_var_samp_order_by"] | undefined,
	variance?: GraphQLTypes["fdp_pdp_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "fdp_pdp" */
["fdp_pdp_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["fdp_pdp_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["fdp_pdp_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["fdp_pdp_avg_fields"]: {
	__typename: "fdp_pdp_avg_fields",
	cursorId?: number | undefined
};
	/** order by avg() on columns of table "fdp_pdp" */
["fdp_pdp_avg_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "fdp_pdp". All fields are combined with a logical 'AND'. */
["fdp_pdp_bool_exp"]: {
		_and?: Array<GraphQLTypes["fdp_pdp_bool_exp"]> | undefined,
	_not?: GraphQLTypes["fdp_pdp_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["fdp_pdp_bool_exp"]> | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	date_from?: GraphQLTypes["date_comparison_exp"] | undefined,
	date_to?: GraphQLTypes["date_comparison_exp"] | undefined,
	description?: GraphQLTypes["String_comparison_exp"] | undefined,
	faculty?: GraphQLTypes["faculty_bool_exp"] | undefined,
	faculty_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	file?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	institute?: GraphQLTypes["institute_bool_exp"] | undefined,
	institute_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	nature?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["STATUS_enum_comparison_exp"] | undefined,
	type?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	venue?: GraphQLTypes["String_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "fdp_pdp" */
["fdp_pdp_constraint"]: fdp_pdp_constraint;
	/** input type for incrementing numeric columns in table "fdp_pdp" */
["fdp_pdp_inc_input"]: {
		cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "fdp_pdp" */
["fdp_pdp_insert_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_from?: GraphQLTypes["date"] | undefined,
	date_to?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	faculty?: GraphQLTypes["faculty_obj_rel_insert_input"] | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute?: GraphQLTypes["institute_obj_rel_insert_input"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate max on columns */
["fdp_pdp_max_fields"]: {
	__typename: "fdp_pdp_max_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_from?: GraphQLTypes["date"] | undefined,
	date_to?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** order by max() on columns of table "fdp_pdp" */
["fdp_pdp_max_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	date_from?: GraphQLTypes["order_by"] | undefined,
	date_to?: GraphQLTypes["order_by"] | undefined,
	description?: GraphQLTypes["order_by"] | undefined,
	faculty_id?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	nature?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
	venue?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["fdp_pdp_min_fields"]: {
	__typename: "fdp_pdp_min_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_from?: GraphQLTypes["date"] | undefined,
	date_to?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** order by min() on columns of table "fdp_pdp" */
["fdp_pdp_min_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	date_from?: GraphQLTypes["order_by"] | undefined,
	date_to?: GraphQLTypes["order_by"] | undefined,
	description?: GraphQLTypes["order_by"] | undefined,
	faculty_id?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	nature?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
	venue?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "fdp_pdp" */
["fdp_pdp_mutation_response"]: {
	__typename: "fdp_pdp_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["fdp_pdp"]>
};
	/** on_conflict condition type for table "fdp_pdp" */
["fdp_pdp_on_conflict"]: {
		constraint: GraphQLTypes["fdp_pdp_constraint"],
	update_columns: Array<GraphQLTypes["fdp_pdp_update_column"]>,
	where?: GraphQLTypes["fdp_pdp_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "fdp_pdp". */
["fdp_pdp_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	date_from?: GraphQLTypes["order_by"] | undefined,
	date_to?: GraphQLTypes["order_by"] | undefined,
	description?: GraphQLTypes["order_by"] | undefined,
	faculty?: GraphQLTypes["faculty_order_by"] | undefined,
	faculty_id?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute?: GraphQLTypes["institute_order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	nature?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
	venue?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: fdp_pdp */
["fdp_pdp_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "fdp_pdp" */
["fdp_pdp_select_column"]: fdp_pdp_select_column;
	/** input type for updating data in table "fdp_pdp" */
["fdp_pdp_set_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_from?: GraphQLTypes["date"] | undefined,
	date_to?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate stddev on columns */
["fdp_pdp_stddev_fields"]: {
	__typename: "fdp_pdp_stddev_fields",
	cursorId?: number | undefined
};
	/** order by stddev() on columns of table "fdp_pdp" */
["fdp_pdp_stddev_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["fdp_pdp_stddev_pop_fields"]: {
	__typename: "fdp_pdp_stddev_pop_fields",
	cursorId?: number | undefined
};
	/** order by stddev_pop() on columns of table "fdp_pdp" */
["fdp_pdp_stddev_pop_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["fdp_pdp_stddev_samp_fields"]: {
	__typename: "fdp_pdp_stddev_samp_fields",
	cursorId?: number | undefined
};
	/** order by stddev_samp() on columns of table "fdp_pdp" */
["fdp_pdp_stddev_samp_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "fdp_pdp" */
["fdp_pdp_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["fdp_pdp_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["fdp_pdp_stream_cursor_value_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_from?: GraphQLTypes["date"] | undefined,
	date_to?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate sum on columns */
["fdp_pdp_sum_fields"]: {
	__typename: "fdp_pdp_sum_fields",
	cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** order by sum() on columns of table "fdp_pdp" */
["fdp_pdp_sum_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** update columns of table "fdp_pdp" */
["fdp_pdp_update_column"]: fdp_pdp_update_column;
	["fdp_pdp_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["fdp_pdp_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["fdp_pdp_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["fdp_pdp_bool_exp"]
};
	/** aggregate var_pop on columns */
["fdp_pdp_var_pop_fields"]: {
	__typename: "fdp_pdp_var_pop_fields",
	cursorId?: number | undefined
};
	/** order by var_pop() on columns of table "fdp_pdp" */
["fdp_pdp_var_pop_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["fdp_pdp_var_samp_fields"]: {
	__typename: "fdp_pdp_var_samp_fields",
	cursorId?: number | undefined
};
	/** order by var_samp() on columns of table "fdp_pdp" */
["fdp_pdp_var_samp_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["fdp_pdp_variance_fields"]: {
	__typename: "fdp_pdp_variance_fields",
	cursorId?: number | undefined
};
	/** order by variance() on columns of table "fdp_pdp" */
["fdp_pdp_variance_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** columns and relationships of "genesis" */
["genesis"]: {
	__typename: "genesis",
	createdAt: GraphQLTypes["timestamptz"],
	createdById: GraphQLTypes["uuid"],
	cursorId: GraphQLTypes["bigint"],
	email_id: string,
	id: GraphQLTypes["uuid"],
	isVerified: string,
	name: string,
	phone: string,
	role: string,
	status: GraphQLTypes["STATUS_enum"],
	updatedAt: GraphQLTypes["timestamptz"],
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregated selection of "genesis" */
["genesis_aggregate"]: {
	__typename: "genesis_aggregate",
	aggregate?: GraphQLTypes["genesis_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["genesis"]>
};
	/** aggregate fields of "genesis" */
["genesis_aggregate_fields"]: {
	__typename: "genesis_aggregate_fields",
	avg?: GraphQLTypes["genesis_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["genesis_max_fields"] | undefined,
	min?: GraphQLTypes["genesis_min_fields"] | undefined,
	stddev?: GraphQLTypes["genesis_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["genesis_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["genesis_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["genesis_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["genesis_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["genesis_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["genesis_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["genesis_avg_fields"]: {
	__typename: "genesis_avg_fields",
	cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "genesis". All fields are combined with a logical 'AND'. */
["genesis_bool_exp"]: {
		_and?: Array<GraphQLTypes["genesis_bool_exp"]> | undefined,
	_not?: GraphQLTypes["genesis_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["genesis_bool_exp"]> | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	email_id?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	isVerified?: GraphQLTypes["String_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	phone?: GraphQLTypes["String_comparison_exp"] | undefined,
	role?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["STATUS_enum_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "genesis" */
["genesis_constraint"]: genesis_constraint;
	/** input type for incrementing numeric columns in table "genesis" */
["genesis_inc_input"]: {
		cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "genesis" */
["genesis_insert_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	email_id?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isVerified?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["genesis_max_fields"]: {
	__typename: "genesis_max_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	email_id?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isVerified?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate min on columns */
["genesis_min_fields"]: {
	__typename: "genesis_min_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	email_id?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isVerified?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** response of any mutation on the table "genesis" */
["genesis_mutation_response"]: {
	__typename: "genesis_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["genesis"]>
};
	/** on_conflict condition type for table "genesis" */
["genesis_on_conflict"]: {
		constraint: GraphQLTypes["genesis_constraint"],
	update_columns: Array<GraphQLTypes["genesis_update_column"]>,
	where?: GraphQLTypes["genesis_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "genesis". */
["genesis_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	email_id?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	isVerified?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	phone?: GraphQLTypes["order_by"] | undefined,
	role?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: genesis */
["genesis_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "genesis" */
["genesis_select_column"]: genesis_select_column;
	/** input type for updating data in table "genesis" */
["genesis_set_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	email_id?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isVerified?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["genesis_stddev_fields"]: {
	__typename: "genesis_stddev_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["genesis_stddev_pop_fields"]: {
	__typename: "genesis_stddev_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["genesis_stddev_samp_fields"]: {
	__typename: "genesis_stddev_samp_fields",
	cursorId?: number | undefined
};
	/** Streaming cursor of the table "genesis" */
["genesis_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["genesis_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["genesis_stream_cursor_value_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	email_id?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isVerified?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["genesis_sum_fields"]: {
	__typename: "genesis_sum_fields",
	cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** update columns of table "genesis" */
["genesis_update_column"]: genesis_update_column;
	["genesis_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["genesis_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["genesis_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["genesis_bool_exp"]
};
	/** aggregate var_pop on columns */
["genesis_var_pop_fields"]: {
	__typename: "genesis_var_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["genesis_var_samp_fields"]: {
	__typename: "genesis_var_samp_fields",
	cursorId?: number | undefined
};
	/** aggregate variance on columns */
["genesis_variance_fields"]: {
	__typename: "genesis_variance_fields",
	cursorId?: number | undefined
};
	/** columns and relationships of "institute" */
["institute"]: {
	__typename: "institute",
	address: string,
	city: string,
	createdAt: GraphQLTypes["timestamptz"],
	createdById: GraphQLTypes["uuid"],
	cursorId: GraphQLTypes["bigint"],
	date_of_establishment: GraphQLTypes["date"],
	/** An array relationship */
	e_governances: Array<GraphQLTypes["e_governance"]>,
	/** An aggregate relationship */
	e_governances_aggregate: GraphQLTypes["e_governance_aggregate"],
	/** An array relationship */
	faculties: Array<GraphQLTypes["faculty"]>,
	/** An aggregate relationship */
	faculties_aggregate: GraphQLTypes["faculty_aggregate"],
	/** An array relationship */
	faculty_fundings: Array<GraphQLTypes["faculty_funding"]>,
	/** An aggregate relationship */
	faculty_fundings_aggregate: GraphQLTypes["faculty_funding_aggregate"],
	/** An array relationship */
	fdp_pdps: Array<GraphQLTypes["fdp_pdp"]>,
	/** An aggregate relationship */
	fdp_pdps_aggregate: GraphQLTypes["fdp_pdp_aggregate"],
	id: GraphQLTypes["uuid"],
	/** An array relationship */
	institute_fundings: Array<GraphQLTypes["institute_funding"]>,
	/** An aggregate relationship */
	institute_fundings_aggregate: GraphQLTypes["institute_funding_aggregate"],
	landmark: string,
	name: string,
	pin: string,
	state: string,
	status: GraphQLTypes["STATUS_enum"],
	type: string,
	updatedAt: GraphQLTypes["timestamptz"],
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website: string
};
	/** aggregated selection of "institute" */
["institute_aggregate"]: {
	__typename: "institute_aggregate",
	aggregate?: GraphQLTypes["institute_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["institute"]>
};
	/** aggregate fields of "institute" */
["institute_aggregate_fields"]: {
	__typename: "institute_aggregate_fields",
	avg?: GraphQLTypes["institute_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["institute_max_fields"] | undefined,
	min?: GraphQLTypes["institute_min_fields"] | undefined,
	stddev?: GraphQLTypes["institute_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["institute_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["institute_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["institute_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["institute_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["institute_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["institute_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["institute_avg_fields"]: {
	__typename: "institute_avg_fields",
	cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "institute". All fields are combined with a logical 'AND'. */
["institute_bool_exp"]: {
		_and?: Array<GraphQLTypes["institute_bool_exp"]> | undefined,
	_not?: GraphQLTypes["institute_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["institute_bool_exp"]> | undefined,
	address?: GraphQLTypes["String_comparison_exp"] | undefined,
	city?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	date_of_establishment?: GraphQLTypes["date_comparison_exp"] | undefined,
	e_governances?: GraphQLTypes["e_governance_bool_exp"] | undefined,
	e_governances_aggregate?: GraphQLTypes["e_governance_aggregate_bool_exp"] | undefined,
	faculties?: GraphQLTypes["faculty_bool_exp"] | undefined,
	faculties_aggregate?: GraphQLTypes["faculty_aggregate_bool_exp"] | undefined,
	faculty_fundings?: GraphQLTypes["faculty_funding_bool_exp"] | undefined,
	faculty_fundings_aggregate?: GraphQLTypes["faculty_funding_aggregate_bool_exp"] | undefined,
	fdp_pdps?: GraphQLTypes["fdp_pdp_bool_exp"] | undefined,
	fdp_pdps_aggregate?: GraphQLTypes["fdp_pdp_aggregate_bool_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	institute_fundings?: GraphQLTypes["institute_funding_bool_exp"] | undefined,
	institute_fundings_aggregate?: GraphQLTypes["institute_funding_aggregate_bool_exp"] | undefined,
	landmark?: GraphQLTypes["String_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	pin?: GraphQLTypes["String_comparison_exp"] | undefined,
	state?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["STATUS_enum_comparison_exp"] | undefined,
	type?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	website?: GraphQLTypes["String_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "institute" */
["institute_constraint"]: institute_constraint;
	/** columns and relationships of "institute_funding" */
["institute_funding"]: {
	__typename: "institute_funding",
	amount: string,
	createdAt: GraphQLTypes["timestamptz"],
	createdById: GraphQLTypes["uuid"],
	cursorId: GraphQLTypes["bigint"],
	id: GraphQLTypes["uuid"],
	/** An object relationship */
	institute: GraphQLTypes["institute"],
	institute_id: GraphQLTypes["uuid"],
	name: string,
	purpose: string,
	status: GraphQLTypes["STATUS_enum"],
	transaction_date: GraphQLTypes["date"],
	transaction_type: string,
	type: string,
	updatedAt: GraphQLTypes["timestamptz"],
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregated selection of "institute_funding" */
["institute_funding_aggregate"]: {
	__typename: "institute_funding_aggregate",
	aggregate?: GraphQLTypes["institute_funding_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["institute_funding"]>
};
	["institute_funding_aggregate_bool_exp"]: {
		count?: GraphQLTypes["institute_funding_aggregate_bool_exp_count"] | undefined
};
	["institute_funding_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["institute_funding_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["institute_funding_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "institute_funding" */
["institute_funding_aggregate_fields"]: {
	__typename: "institute_funding_aggregate_fields",
	avg?: GraphQLTypes["institute_funding_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["institute_funding_max_fields"] | undefined,
	min?: GraphQLTypes["institute_funding_min_fields"] | undefined,
	stddev?: GraphQLTypes["institute_funding_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["institute_funding_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["institute_funding_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["institute_funding_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["institute_funding_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["institute_funding_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["institute_funding_variance_fields"] | undefined
};
	/** order by aggregate values of table "institute_funding" */
["institute_funding_aggregate_order_by"]: {
		avg?: GraphQLTypes["institute_funding_avg_order_by"] | undefined,
	count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["institute_funding_max_order_by"] | undefined,
	min?: GraphQLTypes["institute_funding_min_order_by"] | undefined,
	stddev?: GraphQLTypes["institute_funding_stddev_order_by"] | undefined,
	stddev_pop?: GraphQLTypes["institute_funding_stddev_pop_order_by"] | undefined,
	stddev_samp?: GraphQLTypes["institute_funding_stddev_samp_order_by"] | undefined,
	sum?: GraphQLTypes["institute_funding_sum_order_by"] | undefined,
	var_pop?: GraphQLTypes["institute_funding_var_pop_order_by"] | undefined,
	var_samp?: GraphQLTypes["institute_funding_var_samp_order_by"] | undefined,
	variance?: GraphQLTypes["institute_funding_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "institute_funding" */
["institute_funding_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["institute_funding_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["institute_funding_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["institute_funding_avg_fields"]: {
	__typename: "institute_funding_avg_fields",
	cursorId?: number | undefined
};
	/** order by avg() on columns of table "institute_funding" */
["institute_funding_avg_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "institute_funding". All fields are combined with a logical 'AND'. */
["institute_funding_bool_exp"]: {
		_and?: Array<GraphQLTypes["institute_funding_bool_exp"]> | undefined,
	_not?: GraphQLTypes["institute_funding_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["institute_funding_bool_exp"]> | undefined,
	amount?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	institute?: GraphQLTypes["institute_bool_exp"] | undefined,
	institute_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	purpose?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["STATUS_enum_comparison_exp"] | undefined,
	transaction_date?: GraphQLTypes["date_comparison_exp"] | undefined,
	transaction_type?: GraphQLTypes["String_comparison_exp"] | undefined,
	type?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "institute_funding" */
["institute_funding_constraint"]: institute_funding_constraint;
	/** input type for incrementing numeric columns in table "institute_funding" */
["institute_funding_inc_input"]: {
		cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "institute_funding" */
["institute_funding_insert_input"]: {
		amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute?: GraphQLTypes["institute_obj_rel_insert_input"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["institute_funding_max_fields"]: {
	__typename: "institute_funding_max_fields",
	amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** order by max() on columns of table "institute_funding" */
["institute_funding_max_order_by"]: {
		amount?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	purpose?: GraphQLTypes["order_by"] | undefined,
	transaction_date?: GraphQLTypes["order_by"] | undefined,
	transaction_type?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["institute_funding_min_fields"]: {
	__typename: "institute_funding_min_fields",
	amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** order by min() on columns of table "institute_funding" */
["institute_funding_min_order_by"]: {
		amount?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	purpose?: GraphQLTypes["order_by"] | undefined,
	transaction_date?: GraphQLTypes["order_by"] | undefined,
	transaction_type?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "institute_funding" */
["institute_funding_mutation_response"]: {
	__typename: "institute_funding_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["institute_funding"]>
};
	/** on_conflict condition type for table "institute_funding" */
["institute_funding_on_conflict"]: {
		constraint: GraphQLTypes["institute_funding_constraint"],
	update_columns: Array<GraphQLTypes["institute_funding_update_column"]>,
	where?: GraphQLTypes["institute_funding_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "institute_funding". */
["institute_funding_order_by"]: {
		amount?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute?: GraphQLTypes["institute_order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	purpose?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	transaction_date?: GraphQLTypes["order_by"] | undefined,
	transaction_type?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: institute_funding */
["institute_funding_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "institute_funding" */
["institute_funding_select_column"]: institute_funding_select_column;
	/** input type for updating data in table "institute_funding" */
["institute_funding_set_input"]: {
		amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["institute_funding_stddev_fields"]: {
	__typename: "institute_funding_stddev_fields",
	cursorId?: number | undefined
};
	/** order by stddev() on columns of table "institute_funding" */
["institute_funding_stddev_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["institute_funding_stddev_pop_fields"]: {
	__typename: "institute_funding_stddev_pop_fields",
	cursorId?: number | undefined
};
	/** order by stddev_pop() on columns of table "institute_funding" */
["institute_funding_stddev_pop_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["institute_funding_stddev_samp_fields"]: {
	__typename: "institute_funding_stddev_samp_fields",
	cursorId?: number | undefined
};
	/** order by stddev_samp() on columns of table "institute_funding" */
["institute_funding_stddev_samp_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "institute_funding" */
["institute_funding_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["institute_funding_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["institute_funding_stream_cursor_value_input"]: {
		amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["institute_funding_sum_fields"]: {
	__typename: "institute_funding_sum_fields",
	cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** order by sum() on columns of table "institute_funding" */
["institute_funding_sum_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** update columns of table "institute_funding" */
["institute_funding_update_column"]: institute_funding_update_column;
	["institute_funding_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["institute_funding_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["institute_funding_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["institute_funding_bool_exp"]
};
	/** aggregate var_pop on columns */
["institute_funding_var_pop_fields"]: {
	__typename: "institute_funding_var_pop_fields",
	cursorId?: number | undefined
};
	/** order by var_pop() on columns of table "institute_funding" */
["institute_funding_var_pop_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["institute_funding_var_samp_fields"]: {
	__typename: "institute_funding_var_samp_fields",
	cursorId?: number | undefined
};
	/** order by var_samp() on columns of table "institute_funding" */
["institute_funding_var_samp_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["institute_funding_variance_fields"]: {
	__typename: "institute_funding_variance_fields",
	cursorId?: number | undefined
};
	/** order by variance() on columns of table "institute_funding" */
["institute_funding_variance_order_by"]: {
		cursorId?: GraphQLTypes["order_by"] | undefined
};
	/** input type for incrementing numeric columns in table "institute" */
["institute_inc_input"]: {
		cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "institute" */
["institute_insert_input"]: {
		address?: string | undefined,
	city?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_of_establishment?: GraphQLTypes["date"] | undefined,
	e_governances?: GraphQLTypes["e_governance_arr_rel_insert_input"] | undefined,
	faculties?: GraphQLTypes["faculty_arr_rel_insert_input"] | undefined,
	faculty_fundings?: GraphQLTypes["faculty_funding_arr_rel_insert_input"] | undefined,
	fdp_pdps?: GraphQLTypes["fdp_pdp_arr_rel_insert_input"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_fundings?: GraphQLTypes["institute_funding_arr_rel_insert_input"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate max on columns */
["institute_max_fields"]: {
	__typename: "institute_max_fields",
	address?: string | undefined,
	city?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_of_establishment?: GraphQLTypes["date"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate min on columns */
["institute_min_fields"]: {
	__typename: "institute_min_fields",
	address?: string | undefined,
	city?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_of_establishment?: GraphQLTypes["date"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** response of any mutation on the table "institute" */
["institute_mutation_response"]: {
	__typename: "institute_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["institute"]>
};
	/** input type for inserting object relation for remote table "institute" */
["institute_obj_rel_insert_input"]: {
		data: GraphQLTypes["institute_insert_input"],
	/** upsert condition */
	on_conflict?: GraphQLTypes["institute_on_conflict"] | undefined
};
	/** on_conflict condition type for table "institute" */
["institute_on_conflict"]: {
		constraint: GraphQLTypes["institute_constraint"],
	update_columns: Array<GraphQLTypes["institute_update_column"]>,
	where?: GraphQLTypes["institute_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "institute". */
["institute_order_by"]: {
		address?: GraphQLTypes["order_by"] | undefined,
	city?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	date_of_establishment?: GraphQLTypes["order_by"] | undefined,
	e_governances_aggregate?: GraphQLTypes["e_governance_aggregate_order_by"] | undefined,
	faculties_aggregate?: GraphQLTypes["faculty_aggregate_order_by"] | undefined,
	faculty_fundings_aggregate?: GraphQLTypes["faculty_funding_aggregate_order_by"] | undefined,
	fdp_pdps_aggregate?: GraphQLTypes["fdp_pdp_aggregate_order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_fundings_aggregate?: GraphQLTypes["institute_funding_aggregate_order_by"] | undefined,
	landmark?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	pin?: GraphQLTypes["order_by"] | undefined,
	state?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
	website?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: institute */
["institute_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "institute" */
["institute_select_column"]: institute_select_column;
	/** input type for updating data in table "institute" */
["institute_set_input"]: {
		address?: string | undefined,
	city?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_of_establishment?: GraphQLTypes["date"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate stddev on columns */
["institute_stddev_fields"]: {
	__typename: "institute_stddev_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["institute_stddev_pop_fields"]: {
	__typename: "institute_stddev_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["institute_stddev_samp_fields"]: {
	__typename: "institute_stddev_samp_fields",
	cursorId?: number | undefined
};
	/** Streaming cursor of the table "institute" */
["institute_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["institute_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["institute_stream_cursor_value_input"]: {
		address?: string | undefined,
	city?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	date_of_establishment?: GraphQLTypes["date"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	status?: GraphQLTypes["STATUS_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate sum on columns */
["institute_sum_fields"]: {
	__typename: "institute_sum_fields",
	cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** update columns of table "institute" */
["institute_update_column"]: institute_update_column;
	["institute_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["institute_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["institute_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["institute_bool_exp"]
};
	/** aggregate var_pop on columns */
["institute_var_pop_fields"]: {
	__typename: "institute_var_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["institute_var_samp_fields"]: {
	__typename: "institute_var_samp_fields",
	cursorId?: number | undefined
};
	/** aggregate variance on columns */
["institute_variance_fields"]: {
	__typename: "institute_variance_fields",
	cursorId?: number | undefined
};
	/** mutation root */
["mutation_root"]: {
	__typename: "mutation_root",
	/** delete data from the table: "STATUS" */
	delete_STATUS?: GraphQLTypes["STATUS_mutation_response"] | undefined,
	/** delete single row from the table: "STATUS" */
	delete_STATUS_by_pk?: GraphQLTypes["STATUS"] | undefined,
	/** delete data from the table: "e_governance" */
	delete_e_governance?: GraphQLTypes["e_governance_mutation_response"] | undefined,
	/** delete single row from the table: "e_governance" */
	delete_e_governance_by_pk?: GraphQLTypes["e_governance"] | undefined,
	/** delete data from the table: "faculty" */
	delete_faculty?: GraphQLTypes["faculty_mutation_response"] | undefined,
	/** delete single row from the table: "faculty" */
	delete_faculty_by_pk?: GraphQLTypes["faculty"] | undefined,
	/** delete data from the table: "faculty_funding" */
	delete_faculty_funding?: GraphQLTypes["faculty_funding_mutation_response"] | undefined,
	/** delete single row from the table: "faculty_funding" */
	delete_faculty_funding_by_pk?: GraphQLTypes["faculty_funding"] | undefined,
	/** delete data from the table: "fdp_pdp" */
	delete_fdp_pdp?: GraphQLTypes["fdp_pdp_mutation_response"] | undefined,
	/** delete single row from the table: "fdp_pdp" */
	delete_fdp_pdp_by_pk?: GraphQLTypes["fdp_pdp"] | undefined,
	/** delete data from the table: "genesis" */
	delete_genesis?: GraphQLTypes["genesis_mutation_response"] | undefined,
	/** delete single row from the table: "genesis" */
	delete_genesis_by_pk?: GraphQLTypes["genesis"] | undefined,
	/** delete data from the table: "institute" */
	delete_institute?: GraphQLTypes["institute_mutation_response"] | undefined,
	/** delete single row from the table: "institute" */
	delete_institute_by_pk?: GraphQLTypes["institute"] | undefined,
	/** delete data from the table: "institute_funding" */
	delete_institute_funding?: GraphQLTypes["institute_funding_mutation_response"] | undefined,
	/** delete single row from the table: "institute_funding" */
	delete_institute_funding_by_pk?: GraphQLTypes["institute_funding"] | undefined,
	/** insert data into the table: "STATUS" */
	insert_STATUS?: GraphQLTypes["STATUS_mutation_response"] | undefined,
	/** insert a single row into the table: "STATUS" */
	insert_STATUS_one?: GraphQLTypes["STATUS"] | undefined,
	/** insert data into the table: "e_governance" */
	insert_e_governance?: GraphQLTypes["e_governance_mutation_response"] | undefined,
	/** insert a single row into the table: "e_governance" */
	insert_e_governance_one?: GraphQLTypes["e_governance"] | undefined,
	/** insert data into the table: "faculty" */
	insert_faculty?: GraphQLTypes["faculty_mutation_response"] | undefined,
	/** insert data into the table: "faculty_funding" */
	insert_faculty_funding?: GraphQLTypes["faculty_funding_mutation_response"] | undefined,
	/** insert a single row into the table: "faculty_funding" */
	insert_faculty_funding_one?: GraphQLTypes["faculty_funding"] | undefined,
	/** insert a single row into the table: "faculty" */
	insert_faculty_one?: GraphQLTypes["faculty"] | undefined,
	/** insert data into the table: "fdp_pdp" */
	insert_fdp_pdp?: GraphQLTypes["fdp_pdp_mutation_response"] | undefined,
	/** insert a single row into the table: "fdp_pdp" */
	insert_fdp_pdp_one?: GraphQLTypes["fdp_pdp"] | undefined,
	/** insert data into the table: "genesis" */
	insert_genesis?: GraphQLTypes["genesis_mutation_response"] | undefined,
	/** insert a single row into the table: "genesis" */
	insert_genesis_one?: GraphQLTypes["genesis"] | undefined,
	/** insert data into the table: "institute" */
	insert_institute?: GraphQLTypes["institute_mutation_response"] | undefined,
	/** insert data into the table: "institute_funding" */
	insert_institute_funding?: GraphQLTypes["institute_funding_mutation_response"] | undefined,
	/** insert a single row into the table: "institute_funding" */
	insert_institute_funding_one?: GraphQLTypes["institute_funding"] | undefined,
	/** insert a single row into the table: "institute" */
	insert_institute_one?: GraphQLTypes["institute"] | undefined,
	/** update data of the table: "STATUS" */
	update_STATUS?: GraphQLTypes["STATUS_mutation_response"] | undefined,
	/** update single row of the table: "STATUS" */
	update_STATUS_by_pk?: GraphQLTypes["STATUS"] | undefined,
	/** update multiples rows of table: "STATUS" */
	update_STATUS_many?: Array<GraphQLTypes["STATUS_mutation_response"] | undefined> | undefined,
	/** update data of the table: "e_governance" */
	update_e_governance?: GraphQLTypes["e_governance_mutation_response"] | undefined,
	/** update single row of the table: "e_governance" */
	update_e_governance_by_pk?: GraphQLTypes["e_governance"] | undefined,
	/** update multiples rows of table: "e_governance" */
	update_e_governance_many?: Array<GraphQLTypes["e_governance_mutation_response"] | undefined> | undefined,
	/** update data of the table: "faculty" */
	update_faculty?: GraphQLTypes["faculty_mutation_response"] | undefined,
	/** update single row of the table: "faculty" */
	update_faculty_by_pk?: GraphQLTypes["faculty"] | undefined,
	/** update data of the table: "faculty_funding" */
	update_faculty_funding?: GraphQLTypes["faculty_funding_mutation_response"] | undefined,
	/** update single row of the table: "faculty_funding" */
	update_faculty_funding_by_pk?: GraphQLTypes["faculty_funding"] | undefined,
	/** update multiples rows of table: "faculty_funding" */
	update_faculty_funding_many?: Array<GraphQLTypes["faculty_funding_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "faculty" */
	update_faculty_many?: Array<GraphQLTypes["faculty_mutation_response"] | undefined> | undefined,
	/** update data of the table: "fdp_pdp" */
	update_fdp_pdp?: GraphQLTypes["fdp_pdp_mutation_response"] | undefined,
	/** update single row of the table: "fdp_pdp" */
	update_fdp_pdp_by_pk?: GraphQLTypes["fdp_pdp"] | undefined,
	/** update multiples rows of table: "fdp_pdp" */
	update_fdp_pdp_many?: Array<GraphQLTypes["fdp_pdp_mutation_response"] | undefined> | undefined,
	/** update data of the table: "genesis" */
	update_genesis?: GraphQLTypes["genesis_mutation_response"] | undefined,
	/** update single row of the table: "genesis" */
	update_genesis_by_pk?: GraphQLTypes["genesis"] | undefined,
	/** update multiples rows of table: "genesis" */
	update_genesis_many?: Array<GraphQLTypes["genesis_mutation_response"] | undefined> | undefined,
	/** update data of the table: "institute" */
	update_institute?: GraphQLTypes["institute_mutation_response"] | undefined,
	/** update single row of the table: "institute" */
	update_institute_by_pk?: GraphQLTypes["institute"] | undefined,
	/** update data of the table: "institute_funding" */
	update_institute_funding?: GraphQLTypes["institute_funding_mutation_response"] | undefined,
	/** update single row of the table: "institute_funding" */
	update_institute_funding_by_pk?: GraphQLTypes["institute_funding"] | undefined,
	/** update multiples rows of table: "institute_funding" */
	update_institute_funding_many?: Array<GraphQLTypes["institute_funding_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "institute" */
	update_institute_many?: Array<GraphQLTypes["institute_mutation_response"] | undefined> | undefined
};
	/** column ordering options */
["order_by"]: order_by;
	["query_root"]: {
	__typename: "query_root",
	/** fetch data from the table: "STATUS" */
	STATUS: Array<GraphQLTypes["STATUS"]>,
	/** fetch aggregated fields from the table: "STATUS" */
	STATUS_aggregate: GraphQLTypes["STATUS_aggregate"],
	/** fetch data from the table: "STATUS" using primary key columns */
	STATUS_by_pk?: GraphQLTypes["STATUS"] | undefined,
	/** fetch data from the table: "e_governance" */
	e_governance: Array<GraphQLTypes["e_governance"]>,
	/** fetch aggregated fields from the table: "e_governance" */
	e_governance_aggregate: GraphQLTypes["e_governance_aggregate"],
	/** fetch data from the table: "e_governance" using primary key columns */
	e_governance_by_pk?: GraphQLTypes["e_governance"] | undefined,
	/** fetch data from the table: "faculty" */
	faculty: Array<GraphQLTypes["faculty"]>,
	/** fetch aggregated fields from the table: "faculty" */
	faculty_aggregate: GraphQLTypes["faculty_aggregate"],
	/** fetch data from the table: "faculty" using primary key columns */
	faculty_by_pk?: GraphQLTypes["faculty"] | undefined,
	/** fetch data from the table: "faculty_funding" */
	faculty_funding: Array<GraphQLTypes["faculty_funding"]>,
	/** fetch aggregated fields from the table: "faculty_funding" */
	faculty_funding_aggregate: GraphQLTypes["faculty_funding_aggregate"],
	/** fetch data from the table: "faculty_funding" using primary key columns */
	faculty_funding_by_pk?: GraphQLTypes["faculty_funding"] | undefined,
	/** fetch data from the table: "fdp_pdp" */
	fdp_pdp: Array<GraphQLTypes["fdp_pdp"]>,
	/** fetch aggregated fields from the table: "fdp_pdp" */
	fdp_pdp_aggregate: GraphQLTypes["fdp_pdp_aggregate"],
	/** fetch data from the table: "fdp_pdp" using primary key columns */
	fdp_pdp_by_pk?: GraphQLTypes["fdp_pdp"] | undefined,
	/** fetch data from the table: "genesis" */
	genesis: Array<GraphQLTypes["genesis"]>,
	/** fetch aggregated fields from the table: "genesis" */
	genesis_aggregate: GraphQLTypes["genesis_aggregate"],
	/** fetch data from the table: "genesis" using primary key columns */
	genesis_by_pk?: GraphQLTypes["genesis"] | undefined,
	/** fetch data from the table: "institute" */
	institute: Array<GraphQLTypes["institute"]>,
	/** fetch aggregated fields from the table: "institute" */
	institute_aggregate: GraphQLTypes["institute_aggregate"],
	/** fetch data from the table: "institute" using primary key columns */
	institute_by_pk?: GraphQLTypes["institute"] | undefined,
	/** fetch data from the table: "institute_funding" */
	institute_funding: Array<GraphQLTypes["institute_funding"]>,
	/** fetch aggregated fields from the table: "institute_funding" */
	institute_funding_aggregate: GraphQLTypes["institute_funding_aggregate"],
	/** fetch data from the table: "institute_funding" using primary key columns */
	institute_funding_by_pk?: GraphQLTypes["institute_funding"] | undefined
};
	["subscription_root"]: {
	__typename: "subscription_root",
	/** fetch data from the table: "STATUS" */
	STATUS: Array<GraphQLTypes["STATUS"]>,
	/** fetch aggregated fields from the table: "STATUS" */
	STATUS_aggregate: GraphQLTypes["STATUS_aggregate"],
	/** fetch data from the table: "STATUS" using primary key columns */
	STATUS_by_pk?: GraphQLTypes["STATUS"] | undefined,
	/** fetch data from the table in a streaming manner: "STATUS" */
	STATUS_stream: Array<GraphQLTypes["STATUS"]>,
	/** fetch data from the table: "e_governance" */
	e_governance: Array<GraphQLTypes["e_governance"]>,
	/** fetch aggregated fields from the table: "e_governance" */
	e_governance_aggregate: GraphQLTypes["e_governance_aggregate"],
	/** fetch data from the table: "e_governance" using primary key columns */
	e_governance_by_pk?: GraphQLTypes["e_governance"] | undefined,
	/** fetch data from the table in a streaming manner: "e_governance" */
	e_governance_stream: Array<GraphQLTypes["e_governance"]>,
	/** fetch data from the table: "faculty" */
	faculty: Array<GraphQLTypes["faculty"]>,
	/** fetch aggregated fields from the table: "faculty" */
	faculty_aggregate: GraphQLTypes["faculty_aggregate"],
	/** fetch data from the table: "faculty" using primary key columns */
	faculty_by_pk?: GraphQLTypes["faculty"] | undefined,
	/** fetch data from the table: "faculty_funding" */
	faculty_funding: Array<GraphQLTypes["faculty_funding"]>,
	/** fetch aggregated fields from the table: "faculty_funding" */
	faculty_funding_aggregate: GraphQLTypes["faculty_funding_aggregate"],
	/** fetch data from the table: "faculty_funding" using primary key columns */
	faculty_funding_by_pk?: GraphQLTypes["faculty_funding"] | undefined,
	/** fetch data from the table in a streaming manner: "faculty_funding" */
	faculty_funding_stream: Array<GraphQLTypes["faculty_funding"]>,
	/** fetch data from the table in a streaming manner: "faculty" */
	faculty_stream: Array<GraphQLTypes["faculty"]>,
	/** fetch data from the table: "fdp_pdp" */
	fdp_pdp: Array<GraphQLTypes["fdp_pdp"]>,
	/** fetch aggregated fields from the table: "fdp_pdp" */
	fdp_pdp_aggregate: GraphQLTypes["fdp_pdp_aggregate"],
	/** fetch data from the table: "fdp_pdp" using primary key columns */
	fdp_pdp_by_pk?: GraphQLTypes["fdp_pdp"] | undefined,
	/** fetch data from the table in a streaming manner: "fdp_pdp" */
	fdp_pdp_stream: Array<GraphQLTypes["fdp_pdp"]>,
	/** fetch data from the table: "genesis" */
	genesis: Array<GraphQLTypes["genesis"]>,
	/** fetch aggregated fields from the table: "genesis" */
	genesis_aggregate: GraphQLTypes["genesis_aggregate"],
	/** fetch data from the table: "genesis" using primary key columns */
	genesis_by_pk?: GraphQLTypes["genesis"] | undefined,
	/** fetch data from the table in a streaming manner: "genesis" */
	genesis_stream: Array<GraphQLTypes["genesis"]>,
	/** fetch data from the table: "institute" */
	institute: Array<GraphQLTypes["institute"]>,
	/** fetch aggregated fields from the table: "institute" */
	institute_aggregate: GraphQLTypes["institute_aggregate"],
	/** fetch data from the table: "institute" using primary key columns */
	institute_by_pk?: GraphQLTypes["institute"] | undefined,
	/** fetch data from the table: "institute_funding" */
	institute_funding: Array<GraphQLTypes["institute_funding"]>,
	/** fetch aggregated fields from the table: "institute_funding" */
	institute_funding_aggregate: GraphQLTypes["institute_funding_aggregate"],
	/** fetch data from the table: "institute_funding" using primary key columns */
	institute_funding_by_pk?: GraphQLTypes["institute_funding"] | undefined,
	/** fetch data from the table in a streaming manner: "institute_funding" */
	institute_funding_stream: Array<GraphQLTypes["institute_funding"]>,
	/** fetch data from the table in a streaming manner: "institute" */
	institute_stream: Array<GraphQLTypes["institute"]>
};
	["timestamptz"]: "scalar" & { name: "timestamptz" };
	/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
["timestamptz_comparison_exp"]: {
		_eq?: GraphQLTypes["timestamptz"] | undefined,
	_gt?: GraphQLTypes["timestamptz"] | undefined,
	_gte?: GraphQLTypes["timestamptz"] | undefined,
	_in?: Array<GraphQLTypes["timestamptz"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: GraphQLTypes["timestamptz"] | undefined,
	_lte?: GraphQLTypes["timestamptz"] | undefined,
	_neq?: GraphQLTypes["timestamptz"] | undefined,
	_nin?: Array<GraphQLTypes["timestamptz"]> | undefined
};
	["uuid"]: "scalar" & { name: "uuid" };
	/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
["uuid_comparison_exp"]: {
		_eq?: GraphQLTypes["uuid"] | undefined,
	_gt?: GraphQLTypes["uuid"] | undefined,
	_gte?: GraphQLTypes["uuid"] | undefined,
	_in?: Array<GraphQLTypes["uuid"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: GraphQLTypes["uuid"] | undefined,
	_lte?: GraphQLTypes["uuid"] | undefined,
	_neq?: GraphQLTypes["uuid"] | undefined,
	_nin?: Array<GraphQLTypes["uuid"]> | undefined
}
    }
/** unique or primary key constraints on table "STATUS" */
export const enum STATUS_constraint {
	STATUS_pkey = "STATUS_pkey"
}
export const enum STATUS_enum {
	ACTIVE = "ACTIVE",
	DELETED = "DELETED",
	INACTIVE = "INACTIVE"
}
/** select columns of table "STATUS" */
export const enum STATUS_select_column {
	value = "value"
}
/** update columns of table "STATUS" */
export const enum STATUS_update_column {
	value = "value"
}
/** ordering argument of a cursor */
export const enum cursor_ordering {
	ASC = "ASC",
	DESC = "DESC"
}
/** unique or primary key constraints on table "e_governance" */
export const enum e_governance_constraint {
	e_governance_cursorId_key = "e_governance_cursorId_key",
	e_governance_pkey = "e_governance_pkey"
}
/** select columns of table "e_governance" */
export const enum e_governance_select_column {
	address = "address",
	area = "area",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	description = "description",
	file = "file",
	id = "id",
	institute_id = "institute_id",
	name = "name",
	phone_no = "phone_no",
	service_end_date = "service_end_date",
	service_start_date = "service_start_date",
	status = "status",
	total_amount = "total_amount",
	updatedAt = "updatedAt",
	updatedById = "updatedById",
	website = "website"
}
/** update columns of table "e_governance" */
export const enum e_governance_update_column {
	address = "address",
	area = "area",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	description = "description",
	file = "file",
	id = "id",
	institute_id = "institute_id",
	name = "name",
	phone_no = "phone_no",
	service_end_date = "service_end_date",
	service_start_date = "service_start_date",
	status = "status",
	total_amount = "total_amount",
	updatedAt = "updatedAt",
	updatedById = "updatedById",
	website = "website"
}
/** unique or primary key constraints on table "faculty" */
export const enum faculty_constraint {
	faculty_cursorId_key = "faculty_cursorId_key",
	faculty_pkey = "faculty_pkey"
}
/** unique or primary key constraints on table "faculty_funding" */
export const enum faculty_funding_constraint {
	faculty_funding_cursorId_key = "faculty_funding_cursorId_key",
	faculty_funding_pkey = "faculty_funding_pkey"
}
/** select columns of table "faculty_funding" */
export const enum faculty_funding_select_column {
	amount = "amount",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	faculty_id = "faculty_id",
	file = "file",
	id = "id",
	institute_id = "institute_id",
	nature = "nature",
	status = "status",
	transaction_date = "transaction_date",
	transaction_type = "transaction_type",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** update columns of table "faculty_funding" */
export const enum faculty_funding_update_column {
	amount = "amount",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	faculty_id = "faculty_id",
	file = "file",
	id = "id",
	institute_id = "institute_id",
	nature = "nature",
	status = "status",
	transaction_date = "transaction_date",
	transaction_type = "transaction_type",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** select columns of table "faculty" */
export const enum faculty_select_column {
	address = "address",
	cast = "cast",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	date_of_joining = "date_of_joining",
	designation = "designation",
	dob = "dob",
	email_id = "email_id",
	experience = "experience",
	gender = "gender",
	id = "id",
	institute_id = "institute_id",
	job_type = "job_type",
	minority = "minority",
	name = "name",
	pan_card_no = "pan_card_no",
	phone = "phone",
	qualification = "qualification",
	section = "section",
	staff_type = "staff_type",
	status = "status",
	status_of_approval = "status_of_approval",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** update columns of table "faculty" */
export const enum faculty_update_column {
	address = "address",
	cast = "cast",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	date_of_joining = "date_of_joining",
	designation = "designation",
	dob = "dob",
	email_id = "email_id",
	experience = "experience",
	gender = "gender",
	id = "id",
	institute_id = "institute_id",
	job_type = "job_type",
	minority = "minority",
	name = "name",
	pan_card_no = "pan_card_no",
	phone = "phone",
	qualification = "qualification",
	section = "section",
	staff_type = "staff_type",
	status = "status",
	status_of_approval = "status_of_approval",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** unique or primary key constraints on table "fdp_pdp" */
export const enum fdp_pdp_constraint {
	fdp_pdp_cursorId_key = "fdp_pdp_cursorId_key",
	fdp_pdp_pkey = "fdp_pdp_pkey"
}
/** select columns of table "fdp_pdp" */
export const enum fdp_pdp_select_column {
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	date_from = "date_from",
	date_to = "date_to",
	description = "description",
	faculty_id = "faculty_id",
	file = "file",
	id = "id",
	institute_id = "institute_id",
	name = "name",
	nature = "nature",
	status = "status",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById",
	venue = "venue"
}
/** update columns of table "fdp_pdp" */
export const enum fdp_pdp_update_column {
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	date_from = "date_from",
	date_to = "date_to",
	description = "description",
	faculty_id = "faculty_id",
	file = "file",
	id = "id",
	institute_id = "institute_id",
	name = "name",
	nature = "nature",
	status = "status",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById",
	venue = "venue"
}
/** unique or primary key constraints on table "genesis" */
export const enum genesis_constraint {
	genesis_cursorId_key = "genesis_cursorId_key",
	genesis_pkey = "genesis_pkey"
}
/** select columns of table "genesis" */
export const enum genesis_select_column {
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	email_id = "email_id",
	id = "id",
	isVerified = "isVerified",
	name = "name",
	phone = "phone",
	role = "role",
	status = "status",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** update columns of table "genesis" */
export const enum genesis_update_column {
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	email_id = "email_id",
	id = "id",
	isVerified = "isVerified",
	name = "name",
	phone = "phone",
	role = "role",
	status = "status",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** unique or primary key constraints on table "institute" */
export const enum institute_constraint {
	institute_cursorId_key = "institute_cursorId_key",
	institute_pkey = "institute_pkey"
}
/** unique or primary key constraints on table "institute_funding" */
export const enum institute_funding_constraint {
	institute_funding_cursorId_key = "institute_funding_cursorId_key",
	institute_funding_pkey = "institute_funding_pkey"
}
/** select columns of table "institute_funding" */
export const enum institute_funding_select_column {
	amount = "amount",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	id = "id",
	institute_id = "institute_id",
	name = "name",
	purpose = "purpose",
	status = "status",
	transaction_date = "transaction_date",
	transaction_type = "transaction_type",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** update columns of table "institute_funding" */
export const enum institute_funding_update_column {
	amount = "amount",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	id = "id",
	institute_id = "institute_id",
	name = "name",
	purpose = "purpose",
	status = "status",
	transaction_date = "transaction_date",
	transaction_type = "transaction_type",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** select columns of table "institute" */
export const enum institute_select_column {
	address = "address",
	city = "city",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	date_of_establishment = "date_of_establishment",
	id = "id",
	landmark = "landmark",
	name = "name",
	pin = "pin",
	state = "state",
	status = "status",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById",
	website = "website"
}
/** update columns of table "institute" */
export const enum institute_update_column {
	address = "address",
	city = "city",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	date_of_establishment = "date_of_establishment",
	id = "id",
	landmark = "landmark",
	name = "name",
	pin = "pin",
	state = "state",
	status = "status",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById",
	website = "website"
}
/** column ordering options */
export const enum order_by {
	asc = "asc",
	asc_nulls_first = "asc_nulls_first",
	asc_nulls_last = "asc_nulls_last",
	desc = "desc",
	desc_nulls_first = "desc_nulls_first",
	desc_nulls_last = "desc_nulls_last"
}

type ZEUS_VARIABLES = {
	["Int_comparison_exp"]: ValueTypes["Int_comparison_exp"];
	["STATUS_bool_exp"]: ValueTypes["STATUS_bool_exp"];
	["STATUS_constraint"]: ValueTypes["STATUS_constraint"];
	["STATUS_enum"]: ValueTypes["STATUS_enum"];
	["STATUS_enum_comparison_exp"]: ValueTypes["STATUS_enum_comparison_exp"];
	["STATUS_insert_input"]: ValueTypes["STATUS_insert_input"];
	["STATUS_on_conflict"]: ValueTypes["STATUS_on_conflict"];
	["STATUS_order_by"]: ValueTypes["STATUS_order_by"];
	["STATUS_pk_columns_input"]: ValueTypes["STATUS_pk_columns_input"];
	["STATUS_select_column"]: ValueTypes["STATUS_select_column"];
	["STATUS_set_input"]: ValueTypes["STATUS_set_input"];
	["STATUS_stream_cursor_input"]: ValueTypes["STATUS_stream_cursor_input"];
	["STATUS_stream_cursor_value_input"]: ValueTypes["STATUS_stream_cursor_value_input"];
	["STATUS_update_column"]: ValueTypes["STATUS_update_column"];
	["STATUS_updates"]: ValueTypes["STATUS_updates"];
	["String_comparison_exp"]: ValueTypes["String_comparison_exp"];
	["bigint"]: ValueTypes["bigint"];
	["bigint_comparison_exp"]: ValueTypes["bigint_comparison_exp"];
	["cursor_ordering"]: ValueTypes["cursor_ordering"];
	["date"]: ValueTypes["date"];
	["date_comparison_exp"]: ValueTypes["date_comparison_exp"];
	["e_governance_aggregate_bool_exp"]: ValueTypes["e_governance_aggregate_bool_exp"];
	["e_governance_aggregate_bool_exp_count"]: ValueTypes["e_governance_aggregate_bool_exp_count"];
	["e_governance_aggregate_order_by"]: ValueTypes["e_governance_aggregate_order_by"];
	["e_governance_arr_rel_insert_input"]: ValueTypes["e_governance_arr_rel_insert_input"];
	["e_governance_avg_order_by"]: ValueTypes["e_governance_avg_order_by"];
	["e_governance_bool_exp"]: ValueTypes["e_governance_bool_exp"];
	["e_governance_constraint"]: ValueTypes["e_governance_constraint"];
	["e_governance_inc_input"]: ValueTypes["e_governance_inc_input"];
	["e_governance_insert_input"]: ValueTypes["e_governance_insert_input"];
	["e_governance_max_order_by"]: ValueTypes["e_governance_max_order_by"];
	["e_governance_min_order_by"]: ValueTypes["e_governance_min_order_by"];
	["e_governance_on_conflict"]: ValueTypes["e_governance_on_conflict"];
	["e_governance_order_by"]: ValueTypes["e_governance_order_by"];
	["e_governance_pk_columns_input"]: ValueTypes["e_governance_pk_columns_input"];
	["e_governance_select_column"]: ValueTypes["e_governance_select_column"];
	["e_governance_set_input"]: ValueTypes["e_governance_set_input"];
	["e_governance_stddev_order_by"]: ValueTypes["e_governance_stddev_order_by"];
	["e_governance_stddev_pop_order_by"]: ValueTypes["e_governance_stddev_pop_order_by"];
	["e_governance_stddev_samp_order_by"]: ValueTypes["e_governance_stddev_samp_order_by"];
	["e_governance_stream_cursor_input"]: ValueTypes["e_governance_stream_cursor_input"];
	["e_governance_stream_cursor_value_input"]: ValueTypes["e_governance_stream_cursor_value_input"];
	["e_governance_sum_order_by"]: ValueTypes["e_governance_sum_order_by"];
	["e_governance_update_column"]: ValueTypes["e_governance_update_column"];
	["e_governance_updates"]: ValueTypes["e_governance_updates"];
	["e_governance_var_pop_order_by"]: ValueTypes["e_governance_var_pop_order_by"];
	["e_governance_var_samp_order_by"]: ValueTypes["e_governance_var_samp_order_by"];
	["e_governance_variance_order_by"]: ValueTypes["e_governance_variance_order_by"];
	["faculty_aggregate_bool_exp"]: ValueTypes["faculty_aggregate_bool_exp"];
	["faculty_aggregate_bool_exp_count"]: ValueTypes["faculty_aggregate_bool_exp_count"];
	["faculty_aggregate_order_by"]: ValueTypes["faculty_aggregate_order_by"];
	["faculty_arr_rel_insert_input"]: ValueTypes["faculty_arr_rel_insert_input"];
	["faculty_avg_order_by"]: ValueTypes["faculty_avg_order_by"];
	["faculty_bool_exp"]: ValueTypes["faculty_bool_exp"];
	["faculty_constraint"]: ValueTypes["faculty_constraint"];
	["faculty_funding_aggregate_bool_exp"]: ValueTypes["faculty_funding_aggregate_bool_exp"];
	["faculty_funding_aggregate_bool_exp_count"]: ValueTypes["faculty_funding_aggregate_bool_exp_count"];
	["faculty_funding_aggregate_order_by"]: ValueTypes["faculty_funding_aggregate_order_by"];
	["faculty_funding_arr_rel_insert_input"]: ValueTypes["faculty_funding_arr_rel_insert_input"];
	["faculty_funding_avg_order_by"]: ValueTypes["faculty_funding_avg_order_by"];
	["faculty_funding_bool_exp"]: ValueTypes["faculty_funding_bool_exp"];
	["faculty_funding_constraint"]: ValueTypes["faculty_funding_constraint"];
	["faculty_funding_inc_input"]: ValueTypes["faculty_funding_inc_input"];
	["faculty_funding_insert_input"]: ValueTypes["faculty_funding_insert_input"];
	["faculty_funding_max_order_by"]: ValueTypes["faculty_funding_max_order_by"];
	["faculty_funding_min_order_by"]: ValueTypes["faculty_funding_min_order_by"];
	["faculty_funding_on_conflict"]: ValueTypes["faculty_funding_on_conflict"];
	["faculty_funding_order_by"]: ValueTypes["faculty_funding_order_by"];
	["faculty_funding_pk_columns_input"]: ValueTypes["faculty_funding_pk_columns_input"];
	["faculty_funding_select_column"]: ValueTypes["faculty_funding_select_column"];
	["faculty_funding_set_input"]: ValueTypes["faculty_funding_set_input"];
	["faculty_funding_stddev_order_by"]: ValueTypes["faculty_funding_stddev_order_by"];
	["faculty_funding_stddev_pop_order_by"]: ValueTypes["faculty_funding_stddev_pop_order_by"];
	["faculty_funding_stddev_samp_order_by"]: ValueTypes["faculty_funding_stddev_samp_order_by"];
	["faculty_funding_stream_cursor_input"]: ValueTypes["faculty_funding_stream_cursor_input"];
	["faculty_funding_stream_cursor_value_input"]: ValueTypes["faculty_funding_stream_cursor_value_input"];
	["faculty_funding_sum_order_by"]: ValueTypes["faculty_funding_sum_order_by"];
	["faculty_funding_update_column"]: ValueTypes["faculty_funding_update_column"];
	["faculty_funding_updates"]: ValueTypes["faculty_funding_updates"];
	["faculty_funding_var_pop_order_by"]: ValueTypes["faculty_funding_var_pop_order_by"];
	["faculty_funding_var_samp_order_by"]: ValueTypes["faculty_funding_var_samp_order_by"];
	["faculty_funding_variance_order_by"]: ValueTypes["faculty_funding_variance_order_by"];
	["faculty_inc_input"]: ValueTypes["faculty_inc_input"];
	["faculty_insert_input"]: ValueTypes["faculty_insert_input"];
	["faculty_max_order_by"]: ValueTypes["faculty_max_order_by"];
	["faculty_min_order_by"]: ValueTypes["faculty_min_order_by"];
	["faculty_obj_rel_insert_input"]: ValueTypes["faculty_obj_rel_insert_input"];
	["faculty_on_conflict"]: ValueTypes["faculty_on_conflict"];
	["faculty_order_by"]: ValueTypes["faculty_order_by"];
	["faculty_pk_columns_input"]: ValueTypes["faculty_pk_columns_input"];
	["faculty_select_column"]: ValueTypes["faculty_select_column"];
	["faculty_set_input"]: ValueTypes["faculty_set_input"];
	["faculty_stddev_order_by"]: ValueTypes["faculty_stddev_order_by"];
	["faculty_stddev_pop_order_by"]: ValueTypes["faculty_stddev_pop_order_by"];
	["faculty_stddev_samp_order_by"]: ValueTypes["faculty_stddev_samp_order_by"];
	["faculty_stream_cursor_input"]: ValueTypes["faculty_stream_cursor_input"];
	["faculty_stream_cursor_value_input"]: ValueTypes["faculty_stream_cursor_value_input"];
	["faculty_sum_order_by"]: ValueTypes["faculty_sum_order_by"];
	["faculty_update_column"]: ValueTypes["faculty_update_column"];
	["faculty_updates"]: ValueTypes["faculty_updates"];
	["faculty_var_pop_order_by"]: ValueTypes["faculty_var_pop_order_by"];
	["faculty_var_samp_order_by"]: ValueTypes["faculty_var_samp_order_by"];
	["faculty_variance_order_by"]: ValueTypes["faculty_variance_order_by"];
	["fdp_pdp_aggregate_bool_exp"]: ValueTypes["fdp_pdp_aggregate_bool_exp"];
	["fdp_pdp_aggregate_bool_exp_count"]: ValueTypes["fdp_pdp_aggregate_bool_exp_count"];
	["fdp_pdp_aggregate_order_by"]: ValueTypes["fdp_pdp_aggregate_order_by"];
	["fdp_pdp_arr_rel_insert_input"]: ValueTypes["fdp_pdp_arr_rel_insert_input"];
	["fdp_pdp_avg_order_by"]: ValueTypes["fdp_pdp_avg_order_by"];
	["fdp_pdp_bool_exp"]: ValueTypes["fdp_pdp_bool_exp"];
	["fdp_pdp_constraint"]: ValueTypes["fdp_pdp_constraint"];
	["fdp_pdp_inc_input"]: ValueTypes["fdp_pdp_inc_input"];
	["fdp_pdp_insert_input"]: ValueTypes["fdp_pdp_insert_input"];
	["fdp_pdp_max_order_by"]: ValueTypes["fdp_pdp_max_order_by"];
	["fdp_pdp_min_order_by"]: ValueTypes["fdp_pdp_min_order_by"];
	["fdp_pdp_on_conflict"]: ValueTypes["fdp_pdp_on_conflict"];
	["fdp_pdp_order_by"]: ValueTypes["fdp_pdp_order_by"];
	["fdp_pdp_pk_columns_input"]: ValueTypes["fdp_pdp_pk_columns_input"];
	["fdp_pdp_select_column"]: ValueTypes["fdp_pdp_select_column"];
	["fdp_pdp_set_input"]: ValueTypes["fdp_pdp_set_input"];
	["fdp_pdp_stddev_order_by"]: ValueTypes["fdp_pdp_stddev_order_by"];
	["fdp_pdp_stddev_pop_order_by"]: ValueTypes["fdp_pdp_stddev_pop_order_by"];
	["fdp_pdp_stddev_samp_order_by"]: ValueTypes["fdp_pdp_stddev_samp_order_by"];
	["fdp_pdp_stream_cursor_input"]: ValueTypes["fdp_pdp_stream_cursor_input"];
	["fdp_pdp_stream_cursor_value_input"]: ValueTypes["fdp_pdp_stream_cursor_value_input"];
	["fdp_pdp_sum_order_by"]: ValueTypes["fdp_pdp_sum_order_by"];
	["fdp_pdp_update_column"]: ValueTypes["fdp_pdp_update_column"];
	["fdp_pdp_updates"]: ValueTypes["fdp_pdp_updates"];
	["fdp_pdp_var_pop_order_by"]: ValueTypes["fdp_pdp_var_pop_order_by"];
	["fdp_pdp_var_samp_order_by"]: ValueTypes["fdp_pdp_var_samp_order_by"];
	["fdp_pdp_variance_order_by"]: ValueTypes["fdp_pdp_variance_order_by"];
	["genesis_bool_exp"]: ValueTypes["genesis_bool_exp"];
	["genesis_constraint"]: ValueTypes["genesis_constraint"];
	["genesis_inc_input"]: ValueTypes["genesis_inc_input"];
	["genesis_insert_input"]: ValueTypes["genesis_insert_input"];
	["genesis_on_conflict"]: ValueTypes["genesis_on_conflict"];
	["genesis_order_by"]: ValueTypes["genesis_order_by"];
	["genesis_pk_columns_input"]: ValueTypes["genesis_pk_columns_input"];
	["genesis_select_column"]: ValueTypes["genesis_select_column"];
	["genesis_set_input"]: ValueTypes["genesis_set_input"];
	["genesis_stream_cursor_input"]: ValueTypes["genesis_stream_cursor_input"];
	["genesis_stream_cursor_value_input"]: ValueTypes["genesis_stream_cursor_value_input"];
	["genesis_update_column"]: ValueTypes["genesis_update_column"];
	["genesis_updates"]: ValueTypes["genesis_updates"];
	["institute_bool_exp"]: ValueTypes["institute_bool_exp"];
	["institute_constraint"]: ValueTypes["institute_constraint"];
	["institute_funding_aggregate_bool_exp"]: ValueTypes["institute_funding_aggregate_bool_exp"];
	["institute_funding_aggregate_bool_exp_count"]: ValueTypes["institute_funding_aggregate_bool_exp_count"];
	["institute_funding_aggregate_order_by"]: ValueTypes["institute_funding_aggregate_order_by"];
	["institute_funding_arr_rel_insert_input"]: ValueTypes["institute_funding_arr_rel_insert_input"];
	["institute_funding_avg_order_by"]: ValueTypes["institute_funding_avg_order_by"];
	["institute_funding_bool_exp"]: ValueTypes["institute_funding_bool_exp"];
	["institute_funding_constraint"]: ValueTypes["institute_funding_constraint"];
	["institute_funding_inc_input"]: ValueTypes["institute_funding_inc_input"];
	["institute_funding_insert_input"]: ValueTypes["institute_funding_insert_input"];
	["institute_funding_max_order_by"]: ValueTypes["institute_funding_max_order_by"];
	["institute_funding_min_order_by"]: ValueTypes["institute_funding_min_order_by"];
	["institute_funding_on_conflict"]: ValueTypes["institute_funding_on_conflict"];
	["institute_funding_order_by"]: ValueTypes["institute_funding_order_by"];
	["institute_funding_pk_columns_input"]: ValueTypes["institute_funding_pk_columns_input"];
	["institute_funding_select_column"]: ValueTypes["institute_funding_select_column"];
	["institute_funding_set_input"]: ValueTypes["institute_funding_set_input"];
	["institute_funding_stddev_order_by"]: ValueTypes["institute_funding_stddev_order_by"];
	["institute_funding_stddev_pop_order_by"]: ValueTypes["institute_funding_stddev_pop_order_by"];
	["institute_funding_stddev_samp_order_by"]: ValueTypes["institute_funding_stddev_samp_order_by"];
	["institute_funding_stream_cursor_input"]: ValueTypes["institute_funding_stream_cursor_input"];
	["institute_funding_stream_cursor_value_input"]: ValueTypes["institute_funding_stream_cursor_value_input"];
	["institute_funding_sum_order_by"]: ValueTypes["institute_funding_sum_order_by"];
	["institute_funding_update_column"]: ValueTypes["institute_funding_update_column"];
	["institute_funding_updates"]: ValueTypes["institute_funding_updates"];
	["institute_funding_var_pop_order_by"]: ValueTypes["institute_funding_var_pop_order_by"];
	["institute_funding_var_samp_order_by"]: ValueTypes["institute_funding_var_samp_order_by"];
	["institute_funding_variance_order_by"]: ValueTypes["institute_funding_variance_order_by"];
	["institute_inc_input"]: ValueTypes["institute_inc_input"];
	["institute_insert_input"]: ValueTypes["institute_insert_input"];
	["institute_obj_rel_insert_input"]: ValueTypes["institute_obj_rel_insert_input"];
	["institute_on_conflict"]: ValueTypes["institute_on_conflict"];
	["institute_order_by"]: ValueTypes["institute_order_by"];
	["institute_pk_columns_input"]: ValueTypes["institute_pk_columns_input"];
	["institute_select_column"]: ValueTypes["institute_select_column"];
	["institute_set_input"]: ValueTypes["institute_set_input"];
	["institute_stream_cursor_input"]: ValueTypes["institute_stream_cursor_input"];
	["institute_stream_cursor_value_input"]: ValueTypes["institute_stream_cursor_value_input"];
	["institute_update_column"]: ValueTypes["institute_update_column"];
	["institute_updates"]: ValueTypes["institute_updates"];
	["order_by"]: ValueTypes["order_by"];
	["timestamptz"]: ValueTypes["timestamptz"];
	["timestamptz_comparison_exp"]: ValueTypes["timestamptz_comparison_exp"];
	["uuid"]: ValueTypes["uuid"];
	["uuid_comparison_exp"]: ValueTypes["uuid_comparison_exp"];
}