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
	date?: ScalarResolver;
	timestamp?: ScalarResolver;
	timestamptz?: ScalarResolver;
	uuid?: ScalarResolver;
}
type ZEUS_UNIONS = never

export type ValueTypes = {
    /** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
["Boolean_comparison_exp"]: {
	_eq?: boolean | undefined | null | Variable<any, string>,
	_gt?: boolean | undefined | null | Variable<any, string>,
	_gte?: boolean | undefined | null | Variable<any, string>,
	_in?: Array<boolean> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: boolean | undefined | null | Variable<any, string>,
	_lte?: boolean | undefined | null | Variable<any, string>,
	_neq?: boolean | undefined | null | Variable<any, string>,
	_nin?: Array<boolean> | undefined | null | Variable<any, string>
};
	/** columns and relationships of "EGovernance" */
["EGovernance"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone_no?:boolean | `@${string}`,
	service_end_date?:boolean | `@${string}`,
	service_start_date?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	total_amount?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "EGovernance" */
["EGovernance_aggregate"]: AliasType<{
	aggregate?:ValueTypes["EGovernance_aggregate_fields"],
	nodes?:ValueTypes["EGovernance"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "EGovernance" */
["EGovernance_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["EGovernance_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["EGovernance_max_fields"],
	min?:ValueTypes["EGovernance_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "EGovernance". All fields are combined with a logical 'AND'. */
["EGovernance_bool_exp"]: {
	_and?: Array<ValueTypes["EGovernance_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["EGovernance_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["EGovernance_bool_exp"]> | undefined | null | Variable<any, string>,
	address?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	area?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	phone_no?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	service_end_date?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	service_start_date?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	total_amount?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	website?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "EGovernance" */
["EGovernance_constraint"]:EGovernance_constraint;
	/** input type for inserting data into table "EGovernance" */
["EGovernance_insert_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	area?: string | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phone_no?: string | undefined | null | Variable<any, string>,
	service_end_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	service_start_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	status?: string | undefined | null | Variable<any, string>,
	total_amount?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["EGovernance_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone_no?:boolean | `@${string}`,
	service_end_date?:boolean | `@${string}`,
	service_start_date?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	total_amount?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["EGovernance_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone_no?:boolean | `@${string}`,
	service_end_date?:boolean | `@${string}`,
	service_start_date?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	total_amount?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "EGovernance" */
["EGovernance_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["EGovernance"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "EGovernance" */
["EGovernance_on_conflict"]: {
	constraint: ValueTypes["EGovernance_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["EGovernance_update_column"]> | Variable<any, string>,
	where?: ValueTypes["EGovernance_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "EGovernance". */
["EGovernance_order_by"]: {
	address?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	area?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phone_no?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	service_end_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	service_start_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	total_amount?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	website?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: EGovernance */
["EGovernance_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "EGovernance" */
["EGovernance_select_column"]:EGovernance_select_column;
	/** input type for updating data in table "EGovernance" */
["EGovernance_set_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	area?: string | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phone_no?: string | undefined | null | Variable<any, string>,
	service_end_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	service_start_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	status?: string | undefined | null | Variable<any, string>,
	total_amount?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "EGovernance" */
["EGovernance_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["EGovernance_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["EGovernance_stream_cursor_value_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	area?: string | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phone_no?: string | undefined | null | Variable<any, string>,
	service_end_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	service_start_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	status?: string | undefined | null | Variable<any, string>,
	total_amount?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** update columns of table "EGovernance" */
["EGovernance_update_column"]:EGovernance_update_column;
	["EGovernance_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["EGovernance_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["EGovernance_bool_exp"] | Variable<any, string>
};
	/** columns and relationships of "Faculty" */
["Faculty"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
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
	status?:boolean | `@${string}`,
	status_of_approval?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "FacultyFunding" */
["FacultyFunding"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "FacultyFunding" */
["FacultyFunding_aggregate"]: AliasType<{
	aggregate?:ValueTypes["FacultyFunding_aggregate_fields"],
	nodes?:ValueTypes["FacultyFunding"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "FacultyFunding" */
["FacultyFunding_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["FacultyFunding_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["FacultyFunding_max_fields"],
	min?:ValueTypes["FacultyFunding_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "FacultyFunding". All fields are combined with a logical 'AND'. */
["FacultyFunding_bool_exp"]: {
	_and?: Array<ValueTypes["FacultyFunding_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["FacultyFunding_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["FacultyFunding_bool_exp"]> | undefined | null | Variable<any, string>,
	amount?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	transaction_type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "FacultyFunding" */
["FacultyFunding_constraint"]:FacultyFunding_constraint;
	/** input type for inserting data into table "FacultyFunding" */
["FacultyFunding_insert_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: string | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transaction_type?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["FacultyFunding_max_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["FacultyFunding_min_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "FacultyFunding" */
["FacultyFunding_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["FacultyFunding"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "FacultyFunding" */
["FacultyFunding_on_conflict"]: {
	constraint: ValueTypes["FacultyFunding_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["FacultyFunding_update_column"]> | Variable<any, string>,
	where?: ValueTypes["FacultyFunding_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "FacultyFunding". */
["FacultyFunding_order_by"]: {
	amount?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: FacultyFunding */
["FacultyFunding_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "FacultyFunding" */
["FacultyFunding_select_column"]:FacultyFunding_select_column;
	/** input type for updating data in table "FacultyFunding" */
["FacultyFunding_set_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: string | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transaction_type?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "FacultyFunding" */
["FacultyFunding_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["FacultyFunding_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["FacultyFunding_stream_cursor_value_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: string | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transaction_type?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** update columns of table "FacultyFunding" */
["FacultyFunding_update_column"]:FacultyFunding_update_column;
	["FacultyFunding_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["FacultyFunding_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["FacultyFunding_bool_exp"] | Variable<any, string>
};
	/** aggregated selection of "Faculty" */
["Faculty_aggregate"]: AliasType<{
	aggregate?:ValueTypes["Faculty_aggregate_fields"],
	nodes?:ValueTypes["Faculty"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "Faculty" */
["Faculty_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["Faculty_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["Faculty_max_fields"],
	min?:ValueTypes["Faculty_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "Faculty". All fields are combined with a logical 'AND'. */
["Faculty_bool_exp"]: {
	_and?: Array<ValueTypes["Faculty_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["Faculty_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["Faculty_bool_exp"]> | undefined | null | Variable<any, string>,
	address?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	cast?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	date_of_joining?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	designation?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	dob?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	email_id?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	experience?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	gender?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	job_type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	minority?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	pan_card_no?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	phone?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	qualification?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	section?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	staff_type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status_of_approval?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "Faculty" */
["Faculty_constraint"]:Faculty_constraint;
	/** input type for inserting data into table "Faculty" */
["Faculty_insert_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	cast?: string | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
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
	status?: string | undefined | null | Variable<any, string>,
	status_of_approval?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["Faculty_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
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
	status?:boolean | `@${string}`,
	status_of_approval?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["Faculty_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
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
	status?:boolean | `@${string}`,
	status_of_approval?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "Faculty" */
["Faculty_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["Faculty"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "Faculty" */
["Faculty_on_conflict"]: {
	constraint: ValueTypes["Faculty_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["Faculty_update_column"]> | Variable<any, string>,
	where?: ValueTypes["Faculty_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "Faculty". */
["Faculty_order_by"]: {
	address?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cast?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
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
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status_of_approval?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: Faculty */
["Faculty_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "Faculty" */
["Faculty_select_column"]:Faculty_select_column;
	/** input type for updating data in table "Faculty" */
["Faculty_set_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	cast?: string | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
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
	status?: string | undefined | null | Variable<any, string>,
	status_of_approval?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "Faculty" */
["Faculty_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["Faculty_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["Faculty_stream_cursor_value_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	cast?: string | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
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
	status?: string | undefined | null | Variable<any, string>,
	status_of_approval?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** update columns of table "Faculty" */
["Faculty_update_column"]:Faculty_update_column;
	["Faculty_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Faculty_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["Faculty_bool_exp"] | Variable<any, string>
};
	/** columns and relationships of "FdpPdp" */
["FdpPdp"]: AliasType<{
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
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
	status?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "FdpPdp" */
["FdpPdp_aggregate"]: AliasType<{
	aggregate?:ValueTypes["FdpPdp_aggregate_fields"],
	nodes?:ValueTypes["FdpPdp"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "FdpPdp" */
["FdpPdp_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["FdpPdp_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["FdpPdp_max_fields"],
	min?:ValueTypes["FdpPdp_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "FdpPdp". All fields are combined with a logical 'AND'. */
["FdpPdp_bool_exp"]: {
	_and?: Array<ValueTypes["FdpPdp_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["FdpPdp_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["FdpPdp_bool_exp"]> | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	date_from?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	date_to?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	venue?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "FdpPdp" */
["FdpPdp_constraint"]:FdpPdp_constraint;
	/** input type for inserting data into table "FdpPdp" */
["FdpPdp_insert_input"]: {
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
	date_from?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	date_to?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	venue?: string | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["FdpPdp_max_fields"]: AliasType<{
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
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
	status?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["FdpPdp_min_fields"]: AliasType<{
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
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
	status?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "FdpPdp" */
["FdpPdp_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["FdpPdp"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "FdpPdp" */
["FdpPdp_on_conflict"]: {
	constraint: ValueTypes["FdpPdp_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["FdpPdp_update_column"]> | Variable<any, string>,
	where?: ValueTypes["FdpPdp_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "FdpPdp". */
["FdpPdp_order_by"]: {
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
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
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	venue?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: FdpPdp */
["FdpPdp_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "FdpPdp" */
["FdpPdp_select_column"]:FdpPdp_select_column;
	/** input type for updating data in table "FdpPdp" */
["FdpPdp_set_input"]: {
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
	date_from?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	date_to?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	venue?: string | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "FdpPdp" */
["FdpPdp_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["FdpPdp_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["FdpPdp_stream_cursor_value_input"]: {
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
	date_from?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	date_to?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	faculty_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	venue?: string | undefined | null | Variable<any, string>
};
	/** update columns of table "FdpPdp" */
["FdpPdp_update_column"]:FdpPdp_update_column;
	["FdpPdp_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["FdpPdp_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["FdpPdp_bool_exp"] | Variable<any, string>
};
	/** columns and relationships of "Genesis" */
["Genesis"]: AliasType<{
	created_at?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	is_verified?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "Genesis" */
["Genesis_aggregate"]: AliasType<{
	aggregate?:ValueTypes["Genesis_aggregate_fields"],
	nodes?:ValueTypes["Genesis"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "Genesis" */
["Genesis_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["Genesis_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["Genesis_max_fields"],
	min?:ValueTypes["Genesis_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "Genesis". All fields are combined with a logical 'AND'. */
["Genesis_bool_exp"]: {
	_and?: Array<ValueTypes["Genesis_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["Genesis_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["Genesis_bool_exp"]> | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamp_comparison_exp"] | undefined | null | Variable<any, string>,
	email_id?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	is_verified?: ValueTypes["Boolean_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	phone?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamp_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "Genesis" */
["Genesis_constraint"]:Genesis_constraint;
	/** input type for inserting data into table "Genesis" */
["Genesis_insert_input"]: {
	created_at?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>,
	email_id?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	is_verified?: boolean | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phone?: string | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["Genesis_max_fields"]: AliasType<{
	created_at?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["Genesis_min_fields"]: AliasType<{
	created_at?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "Genesis" */
["Genesis_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["Genesis"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "Genesis" */
["Genesis_on_conflict"]: {
	constraint: ValueTypes["Genesis_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["Genesis_update_column"]> | Variable<any, string>,
	where?: ValueTypes["Genesis_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "Genesis". */
["Genesis_order_by"]: {
	created_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	email_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	is_verified?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phone?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: Genesis */
["Genesis_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "Genesis" */
["Genesis_select_column"]:Genesis_select_column;
	/** input type for updating data in table "Genesis" */
["Genesis_set_input"]: {
	created_at?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>,
	email_id?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	is_verified?: boolean | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phone?: string | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "Genesis" */
["Genesis_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["Genesis_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["Genesis_stream_cursor_value_input"]: {
	created_at?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>,
	email_id?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	is_verified?: boolean | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phone?: string | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>
};
	/** update columns of table "Genesis" */
["Genesis_update_column"]:Genesis_update_column;
	["Genesis_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Genesis_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["Genesis_bool_exp"] | Variable<any, string>
};
	/** columns and relationships of "Institute" */
["Institute"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	created_by_id?:boolean | `@${string}`,
	cursor_id?:boolean | `@${string}`,
	date_of_establishment?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	landmark?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pin?:boolean | `@${string}`,
	state?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	updated_by_id?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "InstituteFunding" */
["InstituteFunding"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "InstituteFunding" */
["InstituteFunding_aggregate"]: AliasType<{
	aggregate?:ValueTypes["InstituteFunding_aggregate_fields"],
	nodes?:ValueTypes["InstituteFunding"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "InstituteFunding" */
["InstituteFunding_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["InstituteFunding_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["InstituteFunding_max_fields"],
	min?:ValueTypes["InstituteFunding_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "InstituteFunding". All fields are combined with a logical 'AND'. */
["InstituteFunding_bool_exp"]: {
	_and?: Array<ValueTypes["InstituteFunding_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["InstituteFunding_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["InstituteFunding_bool_exp"]> | undefined | null | Variable<any, string>,
	amount?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	purpose?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	transaction_type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "InstituteFunding" */
["InstituteFunding_constraint"]:InstituteFunding_constraint;
	/** input type for inserting data into table "InstituteFunding" */
["InstituteFunding_insert_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	purpose?: string | undefined | null | Variable<any, string>,
	status?: string | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transaction_type?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["InstituteFunding_max_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["InstituteFunding_min_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "InstituteFunding" */
["InstituteFunding_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["InstituteFunding"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "InstituteFunding" */
["InstituteFunding_on_conflict"]: {
	constraint: ValueTypes["InstituteFunding_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["InstituteFunding_update_column"]> | Variable<any, string>,
	where?: ValueTypes["InstituteFunding_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "InstituteFunding". */
["InstituteFunding_order_by"]: {
	amount?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	purpose?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transaction_type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: InstituteFunding */
["InstituteFunding_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "InstituteFunding" */
["InstituteFunding_select_column"]:InstituteFunding_select_column;
	/** input type for updating data in table "InstituteFunding" */
["InstituteFunding_set_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	purpose?: string | undefined | null | Variable<any, string>,
	status?: string | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transaction_type?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "InstituteFunding" */
["InstituteFunding_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["InstituteFunding_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["InstituteFunding_stream_cursor_value_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	cursorId?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	institute_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	purpose?: string | undefined | null | Variable<any, string>,
	status?: string | undefined | null | Variable<any, string>,
	transaction_date?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transaction_type?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** update columns of table "InstituteFunding" */
["InstituteFunding_update_column"]:InstituteFunding_update_column;
	["InstituteFunding_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["InstituteFunding_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["InstituteFunding_bool_exp"] | Variable<any, string>
};
	/** aggregated selection of "Institute" */
["Institute_aggregate"]: AliasType<{
	aggregate?:ValueTypes["Institute_aggregate_fields"],
	nodes?:ValueTypes["Institute"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "Institute" */
["Institute_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["Institute_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["Institute_max_fields"],
	min?:ValueTypes["Institute_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "Institute". All fields are combined with a logical 'AND'. */
["Institute_bool_exp"]: {
	_and?: Array<ValueTypes["Institute_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["Institute_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["Institute_bool_exp"]> | undefined | null | Variable<any, string>,
	address?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	city?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	created_by_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursor_id?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	date_of_establishment?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	landmark?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	pin?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	state?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updated_by_id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	website?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "Institute" */
["Institute_constraint"]:Institute_constraint;
	/** input type for inserting data into table "Institute" */
["Institute_insert_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	city?: string | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	created_by_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursor_id?: string | undefined | null | Variable<any, string>,
	date_of_establishment?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	landmark?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	pin?: string | undefined | null | Variable<any, string>,
	state?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updated_by_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["Institute_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	created_by_id?:boolean | `@${string}`,
	cursor_id?:boolean | `@${string}`,
	date_of_establishment?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	landmark?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pin?:boolean | `@${string}`,
	state?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	updated_by_id?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["Institute_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	created_by_id?:boolean | `@${string}`,
	cursor_id?:boolean | `@${string}`,
	date_of_establishment?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	landmark?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pin?:boolean | `@${string}`,
	state?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	updated_by_id?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "Institute" */
["Institute_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["Institute"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "Institute" */
["Institute_on_conflict"]: {
	constraint: ValueTypes["Institute_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["Institute_update_column"]> | Variable<any, string>,
	where?: ValueTypes["Institute_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "Institute". */
["Institute_order_by"]: {
	address?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	city?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	created_by_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursor_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	date_of_establishment?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	landmark?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	pin?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	state?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updated_by_id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	website?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: Institute */
["Institute_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "Institute" */
["Institute_select_column"]:Institute_select_column;
	/** input type for updating data in table "Institute" */
["Institute_set_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	city?: string | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	created_by_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursor_id?: string | undefined | null | Variable<any, string>,
	date_of_establishment?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	landmark?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	pin?: string | undefined | null | Variable<any, string>,
	state?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updated_by_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "Institute" */
["Institute_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["Institute_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["Institute_stream_cursor_value_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	city?: string | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	created_by_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursor_id?: string | undefined | null | Variable<any, string>,
	date_of_establishment?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	landmark?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	pin?: string | undefined | null | Variable<any, string>,
	state?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updated_by_id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** update columns of table "Institute" */
["Institute_update_column"]:Institute_update_column;
	["Institute_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Institute_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["Institute_bool_exp"] | Variable<any, string>
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
	/** mutation root */
["mutation_root"]: AliasType<{
delete_EGovernance?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["EGovernance_bool_exp"] | Variable<any, string>},ValueTypes["EGovernance_mutation_response"]],
delete_EGovernance_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["EGovernance"]],
delete_Faculty?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["Faculty_bool_exp"] | Variable<any, string>},ValueTypes["Faculty_mutation_response"]],
delete_FacultyFunding?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["FacultyFunding_bool_exp"] | Variable<any, string>},ValueTypes["FacultyFunding_mutation_response"]],
delete_FacultyFunding_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["FacultyFunding"]],
delete_Faculty_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["Faculty"]],
delete_FdpPdp?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["FdpPdp_bool_exp"] | Variable<any, string>},ValueTypes["FdpPdp_mutation_response"]],
delete_FdpPdp_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["FdpPdp"]],
delete_Genesis?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["Genesis_bool_exp"] | Variable<any, string>},ValueTypes["Genesis_mutation_response"]],
delete_Genesis_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["Genesis"]],
delete_Institute?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["Institute_bool_exp"] | Variable<any, string>},ValueTypes["Institute_mutation_response"]],
delete_InstituteFunding?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["InstituteFunding_bool_exp"] | Variable<any, string>},ValueTypes["InstituteFunding_mutation_response"]],
delete_InstituteFunding_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["InstituteFunding"]],
delete_Institute_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["Institute"]],
insert_EGovernance?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["EGovernance_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["EGovernance_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["EGovernance_mutation_response"]],
insert_EGovernance_one?: [{	/** the row to be inserted */
	object: ValueTypes["EGovernance_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["EGovernance_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["EGovernance"]],
insert_Faculty?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["Faculty_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["Faculty_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["Faculty_mutation_response"]],
insert_FacultyFunding?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["FacultyFunding_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["FacultyFunding_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["FacultyFunding_mutation_response"]],
insert_FacultyFunding_one?: [{	/** the row to be inserted */
	object: ValueTypes["FacultyFunding_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["FacultyFunding_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["FacultyFunding"]],
insert_Faculty_one?: [{	/** the row to be inserted */
	object: ValueTypes["Faculty_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["Faculty_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["Faculty"]],
insert_FdpPdp?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["FdpPdp_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["FdpPdp_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["FdpPdp_mutation_response"]],
insert_FdpPdp_one?: [{	/** the row to be inserted */
	object: ValueTypes["FdpPdp_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["FdpPdp_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["FdpPdp"]],
insert_Genesis?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["Genesis_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["Genesis_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["Genesis_mutation_response"]],
insert_Genesis_one?: [{	/** the row to be inserted */
	object: ValueTypes["Genesis_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["Genesis_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["Genesis"]],
insert_Institute?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["Institute_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["Institute_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["Institute_mutation_response"]],
insert_InstituteFunding?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["InstituteFunding_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["InstituteFunding_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["InstituteFunding_mutation_response"]],
insert_InstituteFunding_one?: [{	/** the row to be inserted */
	object: ValueTypes["InstituteFunding_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["InstituteFunding_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["InstituteFunding"]],
insert_Institute_one?: [{	/** the row to be inserted */
	object: ValueTypes["Institute_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["Institute_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["Institute"]],
update_EGovernance?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["EGovernance_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["EGovernance_bool_exp"] | Variable<any, string>},ValueTypes["EGovernance_mutation_response"]],
update_EGovernance_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["EGovernance_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["EGovernance_pk_columns_input"] | Variable<any, string>},ValueTypes["EGovernance"]],
update_EGovernance_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["EGovernance_updates"]> | Variable<any, string>},ValueTypes["EGovernance_mutation_response"]],
update_Faculty?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Faculty_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["Faculty_bool_exp"] | Variable<any, string>},ValueTypes["Faculty_mutation_response"]],
update_FacultyFunding?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["FacultyFunding_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["FacultyFunding_bool_exp"] | Variable<any, string>},ValueTypes["FacultyFunding_mutation_response"]],
update_FacultyFunding_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["FacultyFunding_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["FacultyFunding_pk_columns_input"] | Variable<any, string>},ValueTypes["FacultyFunding"]],
update_FacultyFunding_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["FacultyFunding_updates"]> | Variable<any, string>},ValueTypes["FacultyFunding_mutation_response"]],
update_Faculty_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Faculty_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["Faculty_pk_columns_input"] | Variable<any, string>},ValueTypes["Faculty"]],
update_Faculty_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["Faculty_updates"]> | Variable<any, string>},ValueTypes["Faculty_mutation_response"]],
update_FdpPdp?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["FdpPdp_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["FdpPdp_bool_exp"] | Variable<any, string>},ValueTypes["FdpPdp_mutation_response"]],
update_FdpPdp_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["FdpPdp_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["FdpPdp_pk_columns_input"] | Variable<any, string>},ValueTypes["FdpPdp"]],
update_FdpPdp_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["FdpPdp_updates"]> | Variable<any, string>},ValueTypes["FdpPdp_mutation_response"]],
update_Genesis?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Genesis_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["Genesis_bool_exp"] | Variable<any, string>},ValueTypes["Genesis_mutation_response"]],
update_Genesis_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Genesis_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["Genesis_pk_columns_input"] | Variable<any, string>},ValueTypes["Genesis"]],
update_Genesis_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["Genesis_updates"]> | Variable<any, string>},ValueTypes["Genesis_mutation_response"]],
update_Institute?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Institute_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["Institute_bool_exp"] | Variable<any, string>},ValueTypes["Institute_mutation_response"]],
update_InstituteFunding?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["InstituteFunding_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["InstituteFunding_bool_exp"] | Variable<any, string>},ValueTypes["InstituteFunding_mutation_response"]],
update_InstituteFunding_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["InstituteFunding_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["InstituteFunding_pk_columns_input"] | Variable<any, string>},ValueTypes["InstituteFunding"]],
update_InstituteFunding_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["InstituteFunding_updates"]> | Variable<any, string>},ValueTypes["InstituteFunding_mutation_response"]],
update_Institute_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Institute_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["Institute_pk_columns_input"] | Variable<any, string>},ValueTypes["Institute"]],
update_Institute_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["Institute_updates"]> | Variable<any, string>},ValueTypes["Institute_mutation_response"]],
		__typename?: boolean | `@${string}`
}>;
	/** column ordering options */
["order_by"]:order_by;
	["query_root"]: AliasType<{
EGovernance?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["EGovernance_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["EGovernance_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["EGovernance_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["EGovernance"]],
EGovernance_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["EGovernance_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["EGovernance_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["EGovernance_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["EGovernance_aggregate"]],
EGovernance_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["EGovernance"]],
Faculty?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Faculty_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Faculty_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Faculty_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Faculty"]],
FacultyFunding?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["FacultyFunding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["FacultyFunding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["FacultyFunding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["FacultyFunding"]],
FacultyFunding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["FacultyFunding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["FacultyFunding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["FacultyFunding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["FacultyFunding_aggregate"]],
FacultyFunding_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["FacultyFunding"]],
Faculty_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Faculty_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Faculty_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Faculty_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Faculty_aggregate"]],
Faculty_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["Faculty"]],
FdpPdp?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["FdpPdp_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["FdpPdp_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["FdpPdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["FdpPdp"]],
FdpPdp_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["FdpPdp_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["FdpPdp_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["FdpPdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["FdpPdp_aggregate"]],
FdpPdp_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["FdpPdp"]],
Genesis?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Genesis_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Genesis_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Genesis_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Genesis"]],
Genesis_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Genesis_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Genesis_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Genesis_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Genesis_aggregate"]],
Genesis_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["Genesis"]],
Institute?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Institute_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Institute_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Institute_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Institute"]],
InstituteFunding?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["InstituteFunding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["InstituteFunding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["InstituteFunding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["InstituteFunding"]],
InstituteFunding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["InstituteFunding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["InstituteFunding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["InstituteFunding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["InstituteFunding_aggregate"]],
InstituteFunding_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["InstituteFunding"]],
Institute_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Institute_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Institute_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Institute_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Institute_aggregate"]],
Institute_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["Institute"]],
		__typename?: boolean | `@${string}`
}>;
	["subscription_root"]: AliasType<{
EGovernance?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["EGovernance_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["EGovernance_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["EGovernance_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["EGovernance"]],
EGovernance_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["EGovernance_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["EGovernance_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["EGovernance_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["EGovernance_aggregate"]],
EGovernance_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["EGovernance"]],
EGovernance_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["EGovernance_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["EGovernance_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["EGovernance"]],
Faculty?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Faculty_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Faculty_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Faculty_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Faculty"]],
FacultyFunding?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["FacultyFunding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["FacultyFunding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["FacultyFunding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["FacultyFunding"]],
FacultyFunding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["FacultyFunding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["FacultyFunding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["FacultyFunding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["FacultyFunding_aggregate"]],
FacultyFunding_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["FacultyFunding"]],
FacultyFunding_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["FacultyFunding_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["FacultyFunding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["FacultyFunding"]],
Faculty_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Faculty_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Faculty_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Faculty_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Faculty_aggregate"]],
Faculty_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["Faculty"]],
Faculty_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["Faculty_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Faculty_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Faculty"]],
FdpPdp?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["FdpPdp_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["FdpPdp_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["FdpPdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["FdpPdp"]],
FdpPdp_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["FdpPdp_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["FdpPdp_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["FdpPdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["FdpPdp_aggregate"]],
FdpPdp_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["FdpPdp"]],
FdpPdp_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["FdpPdp_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["FdpPdp_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["FdpPdp"]],
Genesis?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Genesis_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Genesis_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Genesis_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Genesis"]],
Genesis_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Genesis_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Genesis_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Genesis_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Genesis_aggregate"]],
Genesis_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["Genesis"]],
Genesis_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["Genesis_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Genesis_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Genesis"]],
Institute?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Institute_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Institute_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Institute_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Institute"]],
InstituteFunding?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["InstituteFunding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["InstituteFunding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["InstituteFunding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["InstituteFunding"]],
InstituteFunding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["InstituteFunding_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["InstituteFunding_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["InstituteFunding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["InstituteFunding_aggregate"]],
InstituteFunding_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["InstituteFunding"]],
InstituteFunding_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["InstituteFunding_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["InstituteFunding_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["InstituteFunding"]],
Institute_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Institute_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Institute_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Institute_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Institute_aggregate"]],
Institute_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["Institute"]],
Institute_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["Institute_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Institute_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Institute"]],
		__typename?: boolean | `@${string}`
}>;
	["timestamp"]:unknown;
	/** Boolean expression to compare columns of type "timestamp". All fields are combined with logical 'AND'. */
["timestamp_comparison_exp"]: {
	_eq?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>,
	_gt?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>,
	_gte?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["timestamp"]> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>,
	_lte?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["timestamp"]> | undefined | null | Variable<any, string>
};
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
	/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
["Boolean_comparison_exp"]: {
	_eq?: boolean | undefined | null,
	_gt?: boolean | undefined | null,
	_gte?: boolean | undefined | null,
	_in?: Array<boolean> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: boolean | undefined | null,
	_lte?: boolean | undefined | null,
	_neq?: boolean | undefined | null,
	_nin?: Array<boolean> | undefined | null
};
	/** columns and relationships of "EGovernance" */
["EGovernance"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone_no?:boolean | `@${string}`,
	service_end_date?:boolean | `@${string}`,
	service_start_date?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	total_amount?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "EGovernance" */
["EGovernance_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["EGovernance_aggregate_fields"],
	nodes?:ResolverInputTypes["EGovernance"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "EGovernance" */
["EGovernance_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["EGovernance_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["EGovernance_max_fields"],
	min?:ResolverInputTypes["EGovernance_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "EGovernance". All fields are combined with a logical 'AND'. */
["EGovernance_bool_exp"]: {
	_and?: Array<ResolverInputTypes["EGovernance_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["EGovernance_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["EGovernance_bool_exp"]> | undefined | null,
	address?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	area?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	description?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	file?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	phone_no?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	service_end_date?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	service_start_date?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	total_amount?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	website?: ResolverInputTypes["String_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "EGovernance" */
["EGovernance_constraint"]:EGovernance_constraint;
	/** input type for inserting data into table "EGovernance" */
["EGovernance_insert_input"]: {
	address?: string | undefined | null,
	area?: string | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
	description?: string | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	phone_no?: string | undefined | null,
	service_end_date?: ResolverInputTypes["date"] | undefined | null,
	service_start_date?: ResolverInputTypes["date"] | undefined | null,
	status?: string | undefined | null,
	total_amount?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate max on columns */
["EGovernance_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone_no?:boolean | `@${string}`,
	service_end_date?:boolean | `@${string}`,
	service_start_date?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	total_amount?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["EGovernance_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone_no?:boolean | `@${string}`,
	service_end_date?:boolean | `@${string}`,
	service_start_date?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	total_amount?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "EGovernance" */
["EGovernance_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["EGovernance"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "EGovernance" */
["EGovernance_on_conflict"]: {
	constraint: ResolverInputTypes["EGovernance_constraint"],
	update_columns: Array<ResolverInputTypes["EGovernance_update_column"]>,
	where?: ResolverInputTypes["EGovernance_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "EGovernance". */
["EGovernance_order_by"]: {
	address?: ResolverInputTypes["order_by"] | undefined | null,
	area?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	created_at?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	description?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	phone_no?: ResolverInputTypes["order_by"] | undefined | null,
	service_end_date?: ResolverInputTypes["order_by"] | undefined | null,
	service_start_date?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	total_amount?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
	updated_at?: ResolverInputTypes["order_by"] | undefined | null,
	website?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: EGovernance */
["EGovernance_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "EGovernance" */
["EGovernance_select_column"]:EGovernance_select_column;
	/** input type for updating data in table "EGovernance" */
["EGovernance_set_input"]: {
	address?: string | undefined | null,
	area?: string | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
	description?: string | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	phone_no?: string | undefined | null,
	service_end_date?: ResolverInputTypes["date"] | undefined | null,
	service_start_date?: ResolverInputTypes["date"] | undefined | null,
	status?: string | undefined | null,
	total_amount?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	website?: string | undefined | null
};
	/** Streaming cursor of the table "EGovernance" */
["EGovernance_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["EGovernance_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["EGovernance_stream_cursor_value_input"]: {
	address?: string | undefined | null,
	area?: string | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
	description?: string | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	phone_no?: string | undefined | null,
	service_end_date?: ResolverInputTypes["date"] | undefined | null,
	service_start_date?: ResolverInputTypes["date"] | undefined | null,
	status?: string | undefined | null,
	total_amount?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	website?: string | undefined | null
};
	/** update columns of table "EGovernance" */
["EGovernance_update_column"]:EGovernance_update_column;
	["EGovernance_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["EGovernance_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["EGovernance_bool_exp"]
};
	/** columns and relationships of "Faculty" */
["Faculty"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
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
	status?:boolean | `@${string}`,
	status_of_approval?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "FacultyFunding" */
["FacultyFunding"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "FacultyFunding" */
["FacultyFunding_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["FacultyFunding_aggregate_fields"],
	nodes?:ResolverInputTypes["FacultyFunding"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "FacultyFunding" */
["FacultyFunding_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["FacultyFunding_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["FacultyFunding_max_fields"],
	min?:ResolverInputTypes["FacultyFunding_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "FacultyFunding". All fields are combined with a logical 'AND'. */
["FacultyFunding_bool_exp"]: {
	_and?: Array<ResolverInputTypes["FacultyFunding_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["FacultyFunding_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["FacultyFunding_bool_exp"]> | undefined | null,
	amount?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	faculty_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	file?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	nature?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	transaction_date?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	transaction_type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "FacultyFunding" */
["FacultyFunding_constraint"]:FacultyFunding_constraint;
	/** input type for inserting data into table "FacultyFunding" */
["FacultyFunding_insert_input"]: {
	amount?: string | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
	faculty_id?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	nature?: string | undefined | null,
	status?: string | undefined | null,
	transaction_date?: ResolverInputTypes["date"] | undefined | null,
	transaction_type?: string | undefined | null,
	type?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** aggregate max on columns */
["FacultyFunding_max_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["FacultyFunding_min_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	faculty_id?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "FacultyFunding" */
["FacultyFunding_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["FacultyFunding"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "FacultyFunding" */
["FacultyFunding_on_conflict"]: {
	constraint: ResolverInputTypes["FacultyFunding_constraint"],
	update_columns: Array<ResolverInputTypes["FacultyFunding_update_column"]>,
	where?: ResolverInputTypes["FacultyFunding_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "FacultyFunding". */
["FacultyFunding_order_by"]: {
	amount?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	created_at?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	faculty_id?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	nature?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_date?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_type?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
	updated_at?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: FacultyFunding */
["FacultyFunding_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "FacultyFunding" */
["FacultyFunding_select_column"]:FacultyFunding_select_column;
	/** input type for updating data in table "FacultyFunding" */
["FacultyFunding_set_input"]: {
	amount?: string | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
	faculty_id?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	nature?: string | undefined | null,
	status?: string | undefined | null,
	transaction_date?: ResolverInputTypes["date"] | undefined | null,
	transaction_type?: string | undefined | null,
	type?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** Streaming cursor of the table "FacultyFunding" */
["FacultyFunding_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["FacultyFunding_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["FacultyFunding_stream_cursor_value_input"]: {
	amount?: string | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
	faculty_id?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	nature?: string | undefined | null,
	status?: string | undefined | null,
	transaction_date?: ResolverInputTypes["date"] | undefined | null,
	transaction_type?: string | undefined | null,
	type?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** update columns of table "FacultyFunding" */
["FacultyFunding_update_column"]:FacultyFunding_update_column;
	["FacultyFunding_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["FacultyFunding_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["FacultyFunding_bool_exp"]
};
	/** aggregated selection of "Faculty" */
["Faculty_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["Faculty_aggregate_fields"],
	nodes?:ResolverInputTypes["Faculty"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "Faculty" */
["Faculty_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["Faculty_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["Faculty_max_fields"],
	min?:ResolverInputTypes["Faculty_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "Faculty". All fields are combined with a logical 'AND'. */
["Faculty_bool_exp"]: {
	_and?: Array<ResolverInputTypes["Faculty_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["Faculty_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["Faculty_bool_exp"]> | undefined | null,
	address?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	cast?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	date_of_joining?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	designation?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	dob?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	email_id?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	experience?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	gender?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	job_type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	minority?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	pan_card_no?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	phone?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	qualification?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	section?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	staff_type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status_of_approval?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "Faculty" */
["Faculty_constraint"]:Faculty_constraint;
	/** input type for inserting data into table "Faculty" */
["Faculty_insert_input"]: {
	address?: string | undefined | null,
	cast?: string | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
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
	status?: string | undefined | null,
	status_of_approval?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** aggregate max on columns */
["Faculty_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
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
	status?:boolean | `@${string}`,
	status_of_approval?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["Faculty_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
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
	status?:boolean | `@${string}`,
	status_of_approval?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "Faculty" */
["Faculty_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["Faculty"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "Faculty" */
["Faculty_on_conflict"]: {
	constraint: ResolverInputTypes["Faculty_constraint"],
	update_columns: Array<ResolverInputTypes["Faculty_update_column"]>,
	where?: ResolverInputTypes["Faculty_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "Faculty". */
["Faculty_order_by"]: {
	address?: ResolverInputTypes["order_by"] | undefined | null,
	cast?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	created_at?: ResolverInputTypes["order_by"] | undefined | null,
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
	status?: ResolverInputTypes["order_by"] | undefined | null,
	status_of_approval?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
	updated_at?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: Faculty */
["Faculty_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "Faculty" */
["Faculty_select_column"]:Faculty_select_column;
	/** input type for updating data in table "Faculty" */
["Faculty_set_input"]: {
	address?: string | undefined | null,
	cast?: string | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
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
	status?: string | undefined | null,
	status_of_approval?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** Streaming cursor of the table "Faculty" */
["Faculty_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["Faculty_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["Faculty_stream_cursor_value_input"]: {
	address?: string | undefined | null,
	cast?: string | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
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
	status?: string | undefined | null,
	status_of_approval?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** update columns of table "Faculty" */
["Faculty_update_column"]:Faculty_update_column;
	["Faculty_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Faculty_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["Faculty_bool_exp"]
};
	/** columns and relationships of "FdpPdp" */
["FdpPdp"]: AliasType<{
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
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
	status?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "FdpPdp" */
["FdpPdp_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["FdpPdp_aggregate_fields"],
	nodes?:ResolverInputTypes["FdpPdp"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "FdpPdp" */
["FdpPdp_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["FdpPdp_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["FdpPdp_max_fields"],
	min?:ResolverInputTypes["FdpPdp_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "FdpPdp". All fields are combined with a logical 'AND'. */
["FdpPdp_bool_exp"]: {
	_and?: Array<ResolverInputTypes["FdpPdp_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["FdpPdp_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["FdpPdp_bool_exp"]> | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	date_from?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	date_to?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	description?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	faculty_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	file?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	nature?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	venue?: ResolverInputTypes["String_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "FdpPdp" */
["FdpPdp_constraint"]:FdpPdp_constraint;
	/** input type for inserting data into table "FdpPdp" */
["FdpPdp_insert_input"]: {
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
	date_from?: ResolverInputTypes["date"] | undefined | null,
	date_to?: ResolverInputTypes["date"] | undefined | null,
	description?: string | undefined | null,
	faculty_id?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	nature?: string | undefined | null,
	status?: string | undefined | null,
	type?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	venue?: string | undefined | null
};
	/** aggregate max on columns */
["FdpPdp_max_fields"]: AliasType<{
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
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
	status?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["FdpPdp_min_fields"]: AliasType<{
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
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
	status?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "FdpPdp" */
["FdpPdp_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["FdpPdp"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "FdpPdp" */
["FdpPdp_on_conflict"]: {
	constraint: ResolverInputTypes["FdpPdp_constraint"],
	update_columns: Array<ResolverInputTypes["FdpPdp_update_column"]>,
	where?: ResolverInputTypes["FdpPdp_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "FdpPdp". */
["FdpPdp_order_by"]: {
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	created_at?: ResolverInputTypes["order_by"] | undefined | null,
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
	status?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
	updated_at?: ResolverInputTypes["order_by"] | undefined | null,
	venue?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: FdpPdp */
["FdpPdp_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "FdpPdp" */
["FdpPdp_select_column"]:FdpPdp_select_column;
	/** input type for updating data in table "FdpPdp" */
["FdpPdp_set_input"]: {
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
	date_from?: ResolverInputTypes["date"] | undefined | null,
	date_to?: ResolverInputTypes["date"] | undefined | null,
	description?: string | undefined | null,
	faculty_id?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	nature?: string | undefined | null,
	status?: string | undefined | null,
	type?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	venue?: string | undefined | null
};
	/** Streaming cursor of the table "FdpPdp" */
["FdpPdp_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["FdpPdp_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["FdpPdp_stream_cursor_value_input"]: {
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
	date_from?: ResolverInputTypes["date"] | undefined | null,
	date_to?: ResolverInputTypes["date"] | undefined | null,
	description?: string | undefined | null,
	faculty_id?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	nature?: string | undefined | null,
	status?: string | undefined | null,
	type?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	venue?: string | undefined | null
};
	/** update columns of table "FdpPdp" */
["FdpPdp_update_column"]:FdpPdp_update_column;
	["FdpPdp_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["FdpPdp_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["FdpPdp_bool_exp"]
};
	/** columns and relationships of "Genesis" */
["Genesis"]: AliasType<{
	created_at?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	is_verified?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "Genesis" */
["Genesis_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["Genesis_aggregate_fields"],
	nodes?:ResolverInputTypes["Genesis"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "Genesis" */
["Genesis_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["Genesis_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["Genesis_max_fields"],
	min?:ResolverInputTypes["Genesis_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "Genesis". All fields are combined with a logical 'AND'. */
["Genesis_bool_exp"]: {
	_and?: Array<ResolverInputTypes["Genesis_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["Genesis_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["Genesis_bool_exp"]> | undefined | null,
	created_at?: ResolverInputTypes["timestamp_comparison_exp"] | undefined | null,
	email_id?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	is_verified?: ResolverInputTypes["Boolean_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	phone?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	role?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamp_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "Genesis" */
["Genesis_constraint"]:Genesis_constraint;
	/** input type for inserting data into table "Genesis" */
["Genesis_insert_input"]: {
	created_at?: ResolverInputTypes["timestamp"] | undefined | null,
	email_id?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	is_verified?: boolean | undefined | null,
	name?: string | undefined | null,
	phone?: string | undefined | null,
	role?: string | undefined | null,
	updated_at?: ResolverInputTypes["timestamp"] | undefined | null
};
	/** aggregate max on columns */
["Genesis_max_fields"]: AliasType<{
	created_at?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["Genesis_min_fields"]: AliasType<{
	created_at?:boolean | `@${string}`,
	email_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "Genesis" */
["Genesis_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["Genesis"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "Genesis" */
["Genesis_on_conflict"]: {
	constraint: ResolverInputTypes["Genesis_constraint"],
	update_columns: Array<ResolverInputTypes["Genesis_update_column"]>,
	where?: ResolverInputTypes["Genesis_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "Genesis". */
["Genesis_order_by"]: {
	created_at?: ResolverInputTypes["order_by"] | undefined | null,
	email_id?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	is_verified?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	phone?: ResolverInputTypes["order_by"] | undefined | null,
	role?: ResolverInputTypes["order_by"] | undefined | null,
	updated_at?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: Genesis */
["Genesis_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "Genesis" */
["Genesis_select_column"]:Genesis_select_column;
	/** input type for updating data in table "Genesis" */
["Genesis_set_input"]: {
	created_at?: ResolverInputTypes["timestamp"] | undefined | null,
	email_id?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	is_verified?: boolean | undefined | null,
	name?: string | undefined | null,
	phone?: string | undefined | null,
	role?: string | undefined | null,
	updated_at?: ResolverInputTypes["timestamp"] | undefined | null
};
	/** Streaming cursor of the table "Genesis" */
["Genesis_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["Genesis_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["Genesis_stream_cursor_value_input"]: {
	created_at?: ResolverInputTypes["timestamp"] | undefined | null,
	email_id?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	is_verified?: boolean | undefined | null,
	name?: string | undefined | null,
	phone?: string | undefined | null,
	role?: string | undefined | null,
	updated_at?: ResolverInputTypes["timestamp"] | undefined | null
};
	/** update columns of table "Genesis" */
["Genesis_update_column"]:Genesis_update_column;
	["Genesis_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Genesis_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["Genesis_bool_exp"]
};
	/** columns and relationships of "Institute" */
["Institute"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	created_by_id?:boolean | `@${string}`,
	cursor_id?:boolean | `@${string}`,
	date_of_establishment?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	landmark?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pin?:boolean | `@${string}`,
	state?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	updated_by_id?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "InstituteFunding" */
["InstituteFunding"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "InstituteFunding" */
["InstituteFunding_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["InstituteFunding_aggregate_fields"],
	nodes?:ResolverInputTypes["InstituteFunding"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "InstituteFunding" */
["InstituteFunding_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["InstituteFunding_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["InstituteFunding_max_fields"],
	min?:ResolverInputTypes["InstituteFunding_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "InstituteFunding". All fields are combined with a logical 'AND'. */
["InstituteFunding_bool_exp"]: {
	_and?: Array<ResolverInputTypes["InstituteFunding_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["InstituteFunding_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["InstituteFunding_bool_exp"]> | undefined | null,
	amount?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	purpose?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	transaction_date?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	transaction_type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "InstituteFunding" */
["InstituteFunding_constraint"]:InstituteFunding_constraint;
	/** input type for inserting data into table "InstituteFunding" */
["InstituteFunding_insert_input"]: {
	amount?: string | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	purpose?: string | undefined | null,
	status?: string | undefined | null,
	transaction_date?: ResolverInputTypes["date"] | undefined | null,
	transaction_type?: string | undefined | null,
	type?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** aggregate max on columns */
["InstituteFunding_max_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["InstituteFunding_min_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	institute_id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transaction_date?:boolean | `@${string}`,
	transaction_type?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "InstituteFunding" */
["InstituteFunding_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["InstituteFunding"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "InstituteFunding" */
["InstituteFunding_on_conflict"]: {
	constraint: ResolverInputTypes["InstituteFunding_constraint"],
	update_columns: Array<ResolverInputTypes["InstituteFunding_update_column"]>,
	where?: ResolverInputTypes["InstituteFunding_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "InstituteFunding". */
["InstituteFunding_order_by"]: {
	amount?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	created_at?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	institute_id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	purpose?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_date?: ResolverInputTypes["order_by"] | undefined | null,
	transaction_type?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
	updated_at?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: InstituteFunding */
["InstituteFunding_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "InstituteFunding" */
["InstituteFunding_select_column"]:InstituteFunding_select_column;
	/** input type for updating data in table "InstituteFunding" */
["InstituteFunding_set_input"]: {
	amount?: string | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	purpose?: string | undefined | null,
	status?: string | undefined | null,
	transaction_date?: ResolverInputTypes["date"] | undefined | null,
	transaction_type?: string | undefined | null,
	type?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** Streaming cursor of the table "InstituteFunding" */
["InstituteFunding_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["InstituteFunding_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["InstituteFunding_stream_cursor_value_input"]: {
	amount?: string | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	cursorId?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	institute_id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	purpose?: string | undefined | null,
	status?: string | undefined | null,
	transaction_date?: ResolverInputTypes["date"] | undefined | null,
	transaction_type?: string | undefined | null,
	type?: string | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** update columns of table "InstituteFunding" */
["InstituteFunding_update_column"]:InstituteFunding_update_column;
	["InstituteFunding_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["InstituteFunding_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["InstituteFunding_bool_exp"]
};
	/** aggregated selection of "Institute" */
["Institute_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["Institute_aggregate_fields"],
	nodes?:ResolverInputTypes["Institute"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "Institute" */
["Institute_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["Institute_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["Institute_max_fields"],
	min?:ResolverInputTypes["Institute_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "Institute". All fields are combined with a logical 'AND'. */
["Institute_bool_exp"]: {
	_and?: Array<ResolverInputTypes["Institute_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["Institute_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["Institute_bool_exp"]> | undefined | null,
	address?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	city?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	created_at?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	created_by_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursor_id?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	date_of_establishment?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	landmark?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	pin?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	state?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updated_by_id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	website?: ResolverInputTypes["String_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "Institute" */
["Institute_constraint"]:Institute_constraint;
	/** input type for inserting data into table "Institute" */
["Institute_insert_input"]: {
	address?: string | undefined | null,
	city?: string | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	created_by_id?: ResolverInputTypes["uuid"] | undefined | null,
	cursor_id?: string | undefined | null,
	date_of_establishment?: ResolverInputTypes["date"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	landmark?: string | undefined | null,
	name?: string | undefined | null,
	pin?: string | undefined | null,
	state?: string | undefined | null,
	type?: string | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	updated_by_id?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate max on columns */
["Institute_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	created_by_id?:boolean | `@${string}`,
	cursor_id?:boolean | `@${string}`,
	date_of_establishment?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	landmark?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pin?:boolean | `@${string}`,
	state?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	updated_by_id?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["Institute_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	created_by_id?:boolean | `@${string}`,
	cursor_id?:boolean | `@${string}`,
	date_of_establishment?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	landmark?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	pin?:boolean | `@${string}`,
	state?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	updated_by_id?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "Institute" */
["Institute_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["Institute"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "Institute" */
["Institute_on_conflict"]: {
	constraint: ResolverInputTypes["Institute_constraint"],
	update_columns: Array<ResolverInputTypes["Institute_update_column"]>,
	where?: ResolverInputTypes["Institute_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "Institute". */
["Institute_order_by"]: {
	address?: ResolverInputTypes["order_by"] | undefined | null,
	city?: ResolverInputTypes["order_by"] | undefined | null,
	created_at?: ResolverInputTypes["order_by"] | undefined | null,
	created_by_id?: ResolverInputTypes["order_by"] | undefined | null,
	cursor_id?: ResolverInputTypes["order_by"] | undefined | null,
	date_of_establishment?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	landmark?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	pin?: ResolverInputTypes["order_by"] | undefined | null,
	state?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updated_at?: ResolverInputTypes["order_by"] | undefined | null,
	updated_by_id?: ResolverInputTypes["order_by"] | undefined | null,
	website?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: Institute */
["Institute_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "Institute" */
["Institute_select_column"]:Institute_select_column;
	/** input type for updating data in table "Institute" */
["Institute_set_input"]: {
	address?: string | undefined | null,
	city?: string | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	created_by_id?: ResolverInputTypes["uuid"] | undefined | null,
	cursor_id?: string | undefined | null,
	date_of_establishment?: ResolverInputTypes["date"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	landmark?: string | undefined | null,
	name?: string | undefined | null,
	pin?: string | undefined | null,
	state?: string | undefined | null,
	type?: string | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	updated_by_id?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** Streaming cursor of the table "Institute" */
["Institute_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["Institute_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["Institute_stream_cursor_value_input"]: {
	address?: string | undefined | null,
	city?: string | undefined | null,
	created_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	created_by_id?: ResolverInputTypes["uuid"] | undefined | null,
	cursor_id?: string | undefined | null,
	date_of_establishment?: ResolverInputTypes["date"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	landmark?: string | undefined | null,
	name?: string | undefined | null,
	pin?: string | undefined | null,
	state?: string | undefined | null,
	type?: string | undefined | null,
	updated_at?: ResolverInputTypes["timestamptz"] | undefined | null,
	updated_by_id?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** update columns of table "Institute" */
["Institute_update_column"]:Institute_update_column;
	["Institute_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Institute_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["Institute_bool_exp"]
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
	/** mutation root */
["mutation_root"]: AliasType<{
delete_EGovernance?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["EGovernance_bool_exp"]},ResolverInputTypes["EGovernance_mutation_response"]],
delete_EGovernance_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["EGovernance"]],
delete_Faculty?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["Faculty_bool_exp"]},ResolverInputTypes["Faculty_mutation_response"]],
delete_FacultyFunding?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["FacultyFunding_bool_exp"]},ResolverInputTypes["FacultyFunding_mutation_response"]],
delete_FacultyFunding_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["FacultyFunding"]],
delete_Faculty_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["Faculty"]],
delete_FdpPdp?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["FdpPdp_bool_exp"]},ResolverInputTypes["FdpPdp_mutation_response"]],
delete_FdpPdp_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["FdpPdp"]],
delete_Genesis?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["Genesis_bool_exp"]},ResolverInputTypes["Genesis_mutation_response"]],
delete_Genesis_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["Genesis"]],
delete_Institute?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["Institute_bool_exp"]},ResolverInputTypes["Institute_mutation_response"]],
delete_InstituteFunding?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["InstituteFunding_bool_exp"]},ResolverInputTypes["InstituteFunding_mutation_response"]],
delete_InstituteFunding_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["InstituteFunding"]],
delete_Institute_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["Institute"]],
insert_EGovernance?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["EGovernance_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["EGovernance_on_conflict"] | undefined | null},ResolverInputTypes["EGovernance_mutation_response"]],
insert_EGovernance_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["EGovernance_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["EGovernance_on_conflict"] | undefined | null},ResolverInputTypes["EGovernance"]],
insert_Faculty?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["Faculty_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["Faculty_on_conflict"] | undefined | null},ResolverInputTypes["Faculty_mutation_response"]],
insert_FacultyFunding?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["FacultyFunding_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["FacultyFunding_on_conflict"] | undefined | null},ResolverInputTypes["FacultyFunding_mutation_response"]],
insert_FacultyFunding_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["FacultyFunding_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["FacultyFunding_on_conflict"] | undefined | null},ResolverInputTypes["FacultyFunding"]],
insert_Faculty_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["Faculty_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["Faculty_on_conflict"] | undefined | null},ResolverInputTypes["Faculty"]],
insert_FdpPdp?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["FdpPdp_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["FdpPdp_on_conflict"] | undefined | null},ResolverInputTypes["FdpPdp_mutation_response"]],
insert_FdpPdp_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["FdpPdp_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["FdpPdp_on_conflict"] | undefined | null},ResolverInputTypes["FdpPdp"]],
insert_Genesis?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["Genesis_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["Genesis_on_conflict"] | undefined | null},ResolverInputTypes["Genesis_mutation_response"]],
insert_Genesis_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["Genesis_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["Genesis_on_conflict"] | undefined | null},ResolverInputTypes["Genesis"]],
insert_Institute?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["Institute_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["Institute_on_conflict"] | undefined | null},ResolverInputTypes["Institute_mutation_response"]],
insert_InstituteFunding?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["InstituteFunding_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["InstituteFunding_on_conflict"] | undefined | null},ResolverInputTypes["InstituteFunding_mutation_response"]],
insert_InstituteFunding_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["InstituteFunding_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["InstituteFunding_on_conflict"] | undefined | null},ResolverInputTypes["InstituteFunding"]],
insert_Institute_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["Institute_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["Institute_on_conflict"] | undefined | null},ResolverInputTypes["Institute"]],
update_EGovernance?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["EGovernance_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["EGovernance_bool_exp"]},ResolverInputTypes["EGovernance_mutation_response"]],
update_EGovernance_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["EGovernance_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["EGovernance_pk_columns_input"]},ResolverInputTypes["EGovernance"]],
update_EGovernance_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["EGovernance_updates"]>},ResolverInputTypes["EGovernance_mutation_response"]],
update_Faculty?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Faculty_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["Faculty_bool_exp"]},ResolverInputTypes["Faculty_mutation_response"]],
update_FacultyFunding?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["FacultyFunding_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["FacultyFunding_bool_exp"]},ResolverInputTypes["FacultyFunding_mutation_response"]],
update_FacultyFunding_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["FacultyFunding_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["FacultyFunding_pk_columns_input"]},ResolverInputTypes["FacultyFunding"]],
update_FacultyFunding_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["FacultyFunding_updates"]>},ResolverInputTypes["FacultyFunding_mutation_response"]],
update_Faculty_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Faculty_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["Faculty_pk_columns_input"]},ResolverInputTypes["Faculty"]],
update_Faculty_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["Faculty_updates"]>},ResolverInputTypes["Faculty_mutation_response"]],
update_FdpPdp?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["FdpPdp_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["FdpPdp_bool_exp"]},ResolverInputTypes["FdpPdp_mutation_response"]],
update_FdpPdp_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["FdpPdp_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["FdpPdp_pk_columns_input"]},ResolverInputTypes["FdpPdp"]],
update_FdpPdp_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["FdpPdp_updates"]>},ResolverInputTypes["FdpPdp_mutation_response"]],
update_Genesis?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Genesis_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["Genesis_bool_exp"]},ResolverInputTypes["Genesis_mutation_response"]],
update_Genesis_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Genesis_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["Genesis_pk_columns_input"]},ResolverInputTypes["Genesis"]],
update_Genesis_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["Genesis_updates"]>},ResolverInputTypes["Genesis_mutation_response"]],
update_Institute?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Institute_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["Institute_bool_exp"]},ResolverInputTypes["Institute_mutation_response"]],
update_InstituteFunding?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["InstituteFunding_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["InstituteFunding_bool_exp"]},ResolverInputTypes["InstituteFunding_mutation_response"]],
update_InstituteFunding_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["InstituteFunding_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["InstituteFunding_pk_columns_input"]},ResolverInputTypes["InstituteFunding"]],
update_InstituteFunding_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["InstituteFunding_updates"]>},ResolverInputTypes["InstituteFunding_mutation_response"]],
update_Institute_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Institute_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["Institute_pk_columns_input"]},ResolverInputTypes["Institute"]],
update_Institute_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["Institute_updates"]>},ResolverInputTypes["Institute_mutation_response"]],
		__typename?: boolean | `@${string}`
}>;
	/** column ordering options */
["order_by"]:order_by;
	["query_root"]: AliasType<{
EGovernance?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["EGovernance_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["EGovernance_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["EGovernance_bool_exp"] | undefined | null},ResolverInputTypes["EGovernance"]],
EGovernance_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["EGovernance_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["EGovernance_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["EGovernance_bool_exp"] | undefined | null},ResolverInputTypes["EGovernance_aggregate"]],
EGovernance_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["EGovernance"]],
Faculty?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Faculty_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Faculty_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Faculty_bool_exp"] | undefined | null},ResolverInputTypes["Faculty"]],
FacultyFunding?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["FacultyFunding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["FacultyFunding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["FacultyFunding_bool_exp"] | undefined | null},ResolverInputTypes["FacultyFunding"]],
FacultyFunding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["FacultyFunding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["FacultyFunding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["FacultyFunding_bool_exp"] | undefined | null},ResolverInputTypes["FacultyFunding_aggregate"]],
FacultyFunding_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["FacultyFunding"]],
Faculty_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Faculty_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Faculty_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Faculty_bool_exp"] | undefined | null},ResolverInputTypes["Faculty_aggregate"]],
Faculty_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["Faculty"]],
FdpPdp?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["FdpPdp_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["FdpPdp_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["FdpPdp_bool_exp"] | undefined | null},ResolverInputTypes["FdpPdp"]],
FdpPdp_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["FdpPdp_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["FdpPdp_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["FdpPdp_bool_exp"] | undefined | null},ResolverInputTypes["FdpPdp_aggregate"]],
FdpPdp_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["FdpPdp"]],
Genesis?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Genesis_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Genesis_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Genesis_bool_exp"] | undefined | null},ResolverInputTypes["Genesis"]],
Genesis_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Genesis_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Genesis_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Genesis_bool_exp"] | undefined | null},ResolverInputTypes["Genesis_aggregate"]],
Genesis_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["Genesis"]],
Institute?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Institute_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Institute_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Institute_bool_exp"] | undefined | null},ResolverInputTypes["Institute"]],
InstituteFunding?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["InstituteFunding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["InstituteFunding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["InstituteFunding_bool_exp"] | undefined | null},ResolverInputTypes["InstituteFunding"]],
InstituteFunding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["InstituteFunding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["InstituteFunding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["InstituteFunding_bool_exp"] | undefined | null},ResolverInputTypes["InstituteFunding_aggregate"]],
InstituteFunding_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["InstituteFunding"]],
Institute_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Institute_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Institute_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Institute_bool_exp"] | undefined | null},ResolverInputTypes["Institute_aggregate"]],
Institute_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["Institute"]],
		__typename?: boolean | `@${string}`
}>;
	["subscription_root"]: AliasType<{
EGovernance?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["EGovernance_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["EGovernance_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["EGovernance_bool_exp"] | undefined | null},ResolverInputTypes["EGovernance"]],
EGovernance_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["EGovernance_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["EGovernance_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["EGovernance_bool_exp"] | undefined | null},ResolverInputTypes["EGovernance_aggregate"]],
EGovernance_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["EGovernance"]],
EGovernance_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["EGovernance_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["EGovernance_bool_exp"] | undefined | null},ResolverInputTypes["EGovernance"]],
Faculty?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Faculty_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Faculty_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Faculty_bool_exp"] | undefined | null},ResolverInputTypes["Faculty"]],
FacultyFunding?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["FacultyFunding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["FacultyFunding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["FacultyFunding_bool_exp"] | undefined | null},ResolverInputTypes["FacultyFunding"]],
FacultyFunding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["FacultyFunding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["FacultyFunding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["FacultyFunding_bool_exp"] | undefined | null},ResolverInputTypes["FacultyFunding_aggregate"]],
FacultyFunding_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["FacultyFunding"]],
FacultyFunding_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["FacultyFunding_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["FacultyFunding_bool_exp"] | undefined | null},ResolverInputTypes["FacultyFunding"]],
Faculty_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Faculty_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Faculty_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Faculty_bool_exp"] | undefined | null},ResolverInputTypes["Faculty_aggregate"]],
Faculty_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["Faculty"]],
Faculty_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["Faculty_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["Faculty_bool_exp"] | undefined | null},ResolverInputTypes["Faculty"]],
FdpPdp?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["FdpPdp_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["FdpPdp_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["FdpPdp_bool_exp"] | undefined | null},ResolverInputTypes["FdpPdp"]],
FdpPdp_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["FdpPdp_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["FdpPdp_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["FdpPdp_bool_exp"] | undefined | null},ResolverInputTypes["FdpPdp_aggregate"]],
FdpPdp_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["FdpPdp"]],
FdpPdp_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["FdpPdp_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["FdpPdp_bool_exp"] | undefined | null},ResolverInputTypes["FdpPdp"]],
Genesis?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Genesis_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Genesis_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Genesis_bool_exp"] | undefined | null},ResolverInputTypes["Genesis"]],
Genesis_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Genesis_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Genesis_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Genesis_bool_exp"] | undefined | null},ResolverInputTypes["Genesis_aggregate"]],
Genesis_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["Genesis"]],
Genesis_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["Genesis_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["Genesis_bool_exp"] | undefined | null},ResolverInputTypes["Genesis"]],
Institute?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Institute_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Institute_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Institute_bool_exp"] | undefined | null},ResolverInputTypes["Institute"]],
InstituteFunding?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["InstituteFunding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["InstituteFunding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["InstituteFunding_bool_exp"] | undefined | null},ResolverInputTypes["InstituteFunding"]],
InstituteFunding_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["InstituteFunding_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["InstituteFunding_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["InstituteFunding_bool_exp"] | undefined | null},ResolverInputTypes["InstituteFunding_aggregate"]],
InstituteFunding_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["InstituteFunding"]],
InstituteFunding_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["InstituteFunding_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["InstituteFunding_bool_exp"] | undefined | null},ResolverInputTypes["InstituteFunding"]],
Institute_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Institute_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Institute_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Institute_bool_exp"] | undefined | null},ResolverInputTypes["Institute_aggregate"]],
Institute_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["Institute"]],
Institute_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["Institute_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["Institute_bool_exp"] | undefined | null},ResolverInputTypes["Institute"]],
		__typename?: boolean | `@${string}`
}>;
	["timestamp"]:unknown;
	/** Boolean expression to compare columns of type "timestamp". All fields are combined with logical 'AND'. */
["timestamp_comparison_exp"]: {
	_eq?: ResolverInputTypes["timestamp"] | undefined | null,
	_gt?: ResolverInputTypes["timestamp"] | undefined | null,
	_gte?: ResolverInputTypes["timestamp"] | undefined | null,
	_in?: Array<ResolverInputTypes["timestamp"]> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: ResolverInputTypes["timestamp"] | undefined | null,
	_lte?: ResolverInputTypes["timestamp"] | undefined | null,
	_neq?: ResolverInputTypes["timestamp"] | undefined | null,
	_nin?: Array<ResolverInputTypes["timestamp"]> | undefined | null
};
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
	/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
["Boolean_comparison_exp"]: {
	_eq?: boolean | undefined,
	_gt?: boolean | undefined,
	_gte?: boolean | undefined,
	_in?: Array<boolean> | undefined,
	_is_null?: boolean | undefined,
	_lt?: boolean | undefined,
	_lte?: boolean | undefined,
	_neq?: boolean | undefined,
	_nin?: Array<boolean> | undefined
};
	/** columns and relationships of "EGovernance" */
["EGovernance"]: {
		address: string,
	area: string,
	createdById: ModelTypes["uuid"],
	created_at: ModelTypes["timestamptz"],
	cursorId: string,
	description: string,
	file: string,
	id: ModelTypes["uuid"],
	institute_id: ModelTypes["uuid"],
	name: string,
	phone_no: string,
	service_end_date: ModelTypes["date"],
	service_start_date: ModelTypes["date"],
	status: string,
	total_amount: string,
	updatedById: ModelTypes["uuid"],
	updated_at: ModelTypes["timestamptz"],
	website: string
};
	/** aggregated selection of "EGovernance" */
["EGovernance_aggregate"]: {
		aggregate?: ModelTypes["EGovernance_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["EGovernance"]>
};
	/** aggregate fields of "EGovernance" */
["EGovernance_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["EGovernance_max_fields"] | undefined,
	min?: ModelTypes["EGovernance_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "EGovernance". All fields are combined with a logical 'AND'. */
["EGovernance_bool_exp"]: {
	_and?: Array<ModelTypes["EGovernance_bool_exp"]> | undefined,
	_not?: ModelTypes["EGovernance_bool_exp"] | undefined,
	_or?: Array<ModelTypes["EGovernance_bool_exp"]> | undefined,
	address?: ModelTypes["String_comparison_exp"] | undefined,
	area?: ModelTypes["String_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	created_at?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	cursorId?: ModelTypes["String_comparison_exp"] | undefined,
	description?: ModelTypes["String_comparison_exp"] | undefined,
	file?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	institute_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	phone_no?: ModelTypes["String_comparison_exp"] | undefined,
	service_end_date?: ModelTypes["date_comparison_exp"] | undefined,
	service_start_date?: ModelTypes["date_comparison_exp"] | undefined,
	status?: ModelTypes["String_comparison_exp"] | undefined,
	total_amount?: ModelTypes["String_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined,
	updated_at?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	website?: ModelTypes["String_comparison_exp"] | undefined
};
	["EGovernance_constraint"]:EGovernance_constraint;
	/** input type for inserting data into table "EGovernance" */
["EGovernance_insert_input"]: {
	address?: string | undefined,
	area?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: ModelTypes["date"] | undefined,
	service_start_date?: ModelTypes["date"] | undefined,
	status?: string | undefined,
	total_amount?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	website?: string | undefined
};
	/** aggregate max on columns */
["EGovernance_max_fields"]: {
		address?: string | undefined,
	area?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: ModelTypes["date"] | undefined,
	service_start_date?: ModelTypes["date"] | undefined,
	status?: string | undefined,
	total_amount?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	website?: string | undefined
};
	/** aggregate min on columns */
["EGovernance_min_fields"]: {
		address?: string | undefined,
	area?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: ModelTypes["date"] | undefined,
	service_start_date?: ModelTypes["date"] | undefined,
	status?: string | undefined,
	total_amount?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	website?: string | undefined
};
	/** response of any mutation on the table "EGovernance" */
["EGovernance_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["EGovernance"]>
};
	/** on_conflict condition type for table "EGovernance" */
["EGovernance_on_conflict"]: {
	constraint: ModelTypes["EGovernance_constraint"],
	update_columns: Array<ModelTypes["EGovernance_update_column"]>,
	where?: ModelTypes["EGovernance_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "EGovernance". */
["EGovernance_order_by"]: {
	address?: ModelTypes["order_by"] | undefined,
	area?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	created_at?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	description?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	phone_no?: ModelTypes["order_by"] | undefined,
	service_end_date?: ModelTypes["order_by"] | undefined,
	service_start_date?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	total_amount?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
	updated_at?: ModelTypes["order_by"] | undefined,
	website?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: EGovernance */
["EGovernance_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["EGovernance_select_column"]:EGovernance_select_column;
	/** input type for updating data in table "EGovernance" */
["EGovernance_set_input"]: {
	address?: string | undefined,
	area?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: ModelTypes["date"] | undefined,
	service_start_date?: ModelTypes["date"] | undefined,
	status?: string | undefined,
	total_amount?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	website?: string | undefined
};
	/** Streaming cursor of the table "EGovernance" */
["EGovernance_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["EGovernance_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["EGovernance_stream_cursor_value_input"]: {
	address?: string | undefined,
	area?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: ModelTypes["date"] | undefined,
	service_start_date?: ModelTypes["date"] | undefined,
	status?: string | undefined,
	total_amount?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	website?: string | undefined
};
	["EGovernance_update_column"]:EGovernance_update_column;
	["EGovernance_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["EGovernance_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["EGovernance_bool_exp"]
};
	/** columns and relationships of "Faculty" */
["Faculty"]: {
		address: string,
	cast: string,
	createdById: ModelTypes["uuid"],
	created_at: ModelTypes["timestamptz"],
	cursorId: string,
	date_of_joining: ModelTypes["date"],
	designation: string,
	dob: ModelTypes["date"],
	email_id: string,
	experience: string,
	gender: string,
	id: ModelTypes["uuid"],
	institute_id: ModelTypes["uuid"],
	job_type: string,
	minority: string,
	name: string,
	pan_card_no: string,
	phone: string,
	qualification: string,
	section: string,
	staff_type: string,
	status: string,
	status_of_approval: string,
	updatedById: ModelTypes["uuid"],
	updated_at: ModelTypes["timestamptz"]
};
	/** columns and relationships of "FacultyFunding" */
["FacultyFunding"]: {
		amount: string,
	createdById: ModelTypes["uuid"],
	created_at: ModelTypes["timestamptz"],
	cursorId: string,
	faculty_id: ModelTypes["uuid"],
	file: string,
	id: ModelTypes["uuid"],
	institute_id: ModelTypes["uuid"],
	nature: string,
	status: string,
	transaction_date: ModelTypes["date"],
	transaction_type: string,
	type: string,
	updatedById: ModelTypes["uuid"],
	updated_at: ModelTypes["timestamptz"]
};
	/** aggregated selection of "FacultyFunding" */
["FacultyFunding_aggregate"]: {
		aggregate?: ModelTypes["FacultyFunding_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["FacultyFunding"]>
};
	/** aggregate fields of "FacultyFunding" */
["FacultyFunding_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["FacultyFunding_max_fields"] | undefined,
	min?: ModelTypes["FacultyFunding_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "FacultyFunding". All fields are combined with a logical 'AND'. */
["FacultyFunding_bool_exp"]: {
	_and?: Array<ModelTypes["FacultyFunding_bool_exp"]> | undefined,
	_not?: ModelTypes["FacultyFunding_bool_exp"] | undefined,
	_or?: Array<ModelTypes["FacultyFunding_bool_exp"]> | undefined,
	amount?: ModelTypes["String_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	created_at?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	cursorId?: ModelTypes["String_comparison_exp"] | undefined,
	faculty_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	file?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	institute_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	nature?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["String_comparison_exp"] | undefined,
	transaction_date?: ModelTypes["date_comparison_exp"] | undefined,
	transaction_type?: ModelTypes["String_comparison_exp"] | undefined,
	type?: ModelTypes["String_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined,
	updated_at?: ModelTypes["timestamptz_comparison_exp"] | undefined
};
	["FacultyFunding_constraint"]:FacultyFunding_constraint;
	/** input type for inserting data into table "FacultyFunding" */
["FacultyFunding_insert_input"]: {
	amount?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	/** aggregate max on columns */
["FacultyFunding_max_fields"]: {
		amount?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	/** aggregate min on columns */
["FacultyFunding_min_fields"]: {
		amount?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	/** response of any mutation on the table "FacultyFunding" */
["FacultyFunding_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["FacultyFunding"]>
};
	/** on_conflict condition type for table "FacultyFunding" */
["FacultyFunding_on_conflict"]: {
	constraint: ModelTypes["FacultyFunding_constraint"],
	update_columns: Array<ModelTypes["FacultyFunding_update_column"]>,
	where?: ModelTypes["FacultyFunding_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "FacultyFunding". */
["FacultyFunding_order_by"]: {
	amount?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	created_at?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	faculty_id?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	nature?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	transaction_date?: ModelTypes["order_by"] | undefined,
	transaction_type?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
	updated_at?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: FacultyFunding */
["FacultyFunding_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["FacultyFunding_select_column"]:FacultyFunding_select_column;
	/** input type for updating data in table "FacultyFunding" */
["FacultyFunding_set_input"]: {
	amount?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	/** Streaming cursor of the table "FacultyFunding" */
["FacultyFunding_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["FacultyFunding_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["FacultyFunding_stream_cursor_value_input"]: {
	amount?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	["FacultyFunding_update_column"]:FacultyFunding_update_column;
	["FacultyFunding_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["FacultyFunding_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["FacultyFunding_bool_exp"]
};
	/** aggregated selection of "Faculty" */
["Faculty_aggregate"]: {
		aggregate?: ModelTypes["Faculty_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["Faculty"]>
};
	/** aggregate fields of "Faculty" */
["Faculty_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["Faculty_max_fields"] | undefined,
	min?: ModelTypes["Faculty_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "Faculty". All fields are combined with a logical 'AND'. */
["Faculty_bool_exp"]: {
	_and?: Array<ModelTypes["Faculty_bool_exp"]> | undefined,
	_not?: ModelTypes["Faculty_bool_exp"] | undefined,
	_or?: Array<ModelTypes["Faculty_bool_exp"]> | undefined,
	address?: ModelTypes["String_comparison_exp"] | undefined,
	cast?: ModelTypes["String_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	created_at?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	cursorId?: ModelTypes["String_comparison_exp"] | undefined,
	date_of_joining?: ModelTypes["date_comparison_exp"] | undefined,
	designation?: ModelTypes["String_comparison_exp"] | undefined,
	dob?: ModelTypes["date_comparison_exp"] | undefined,
	email_id?: ModelTypes["String_comparison_exp"] | undefined,
	experience?: ModelTypes["String_comparison_exp"] | undefined,
	gender?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	institute_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	job_type?: ModelTypes["String_comparison_exp"] | undefined,
	minority?: ModelTypes["String_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	pan_card_no?: ModelTypes["String_comparison_exp"] | undefined,
	phone?: ModelTypes["String_comparison_exp"] | undefined,
	qualification?: ModelTypes["String_comparison_exp"] | undefined,
	section?: ModelTypes["String_comparison_exp"] | undefined,
	staff_type?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["String_comparison_exp"] | undefined,
	status_of_approval?: ModelTypes["String_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined,
	updated_at?: ModelTypes["timestamptz_comparison_exp"] | undefined
};
	["Faculty_constraint"]:Faculty_constraint;
	/** input type for inserting data into table "Faculty" */
["Faculty_insert_input"]: {
	address?: string | undefined,
	cast?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
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
	status?: string | undefined,
	status_of_approval?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	/** aggregate max on columns */
["Faculty_max_fields"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
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
	status?: string | undefined,
	status_of_approval?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	/** aggregate min on columns */
["Faculty_min_fields"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
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
	status?: string | undefined,
	status_of_approval?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	/** response of any mutation on the table "Faculty" */
["Faculty_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["Faculty"]>
};
	/** on_conflict condition type for table "Faculty" */
["Faculty_on_conflict"]: {
	constraint: ModelTypes["Faculty_constraint"],
	update_columns: Array<ModelTypes["Faculty_update_column"]>,
	where?: ModelTypes["Faculty_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "Faculty". */
["Faculty_order_by"]: {
	address?: ModelTypes["order_by"] | undefined,
	cast?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	created_at?: ModelTypes["order_by"] | undefined,
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
	status?: ModelTypes["order_by"] | undefined,
	status_of_approval?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
	updated_at?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: Faculty */
["Faculty_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["Faculty_select_column"]:Faculty_select_column;
	/** input type for updating data in table "Faculty" */
["Faculty_set_input"]: {
	address?: string | undefined,
	cast?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
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
	status?: string | undefined,
	status_of_approval?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	/** Streaming cursor of the table "Faculty" */
["Faculty_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["Faculty_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["Faculty_stream_cursor_value_input"]: {
	address?: string | undefined,
	cast?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
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
	status?: string | undefined,
	status_of_approval?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	["Faculty_update_column"]:Faculty_update_column;
	["Faculty_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["Faculty_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["Faculty_bool_exp"]
};
	/** columns and relationships of "FdpPdp" */
["FdpPdp"]: {
		createdById: ModelTypes["uuid"],
	created_at: ModelTypes["timestamptz"],
	cursorId: string,
	date_from: ModelTypes["date"],
	date_to: ModelTypes["date"],
	description: string,
	faculty_id: ModelTypes["uuid"],
	file: string,
	id: ModelTypes["uuid"],
	institute_id: ModelTypes["uuid"],
	name: string,
	nature: string,
	status: string,
	type: string,
	updatedById: ModelTypes["uuid"],
	updated_at: ModelTypes["timestamptz"],
	venue: string
};
	/** aggregated selection of "FdpPdp" */
["FdpPdp_aggregate"]: {
		aggregate?: ModelTypes["FdpPdp_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["FdpPdp"]>
};
	/** aggregate fields of "FdpPdp" */
["FdpPdp_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["FdpPdp_max_fields"] | undefined,
	min?: ModelTypes["FdpPdp_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "FdpPdp". All fields are combined with a logical 'AND'. */
["FdpPdp_bool_exp"]: {
	_and?: Array<ModelTypes["FdpPdp_bool_exp"]> | undefined,
	_not?: ModelTypes["FdpPdp_bool_exp"] | undefined,
	_or?: Array<ModelTypes["FdpPdp_bool_exp"]> | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	created_at?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	cursorId?: ModelTypes["String_comparison_exp"] | undefined,
	date_from?: ModelTypes["date_comparison_exp"] | undefined,
	date_to?: ModelTypes["date_comparison_exp"] | undefined,
	description?: ModelTypes["String_comparison_exp"] | undefined,
	faculty_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	file?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	institute_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	nature?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["String_comparison_exp"] | undefined,
	type?: ModelTypes["String_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined,
	updated_at?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	venue?: ModelTypes["String_comparison_exp"] | undefined
};
	["FdpPdp_constraint"]:FdpPdp_constraint;
	/** input type for inserting data into table "FdpPdp" */
["FdpPdp_insert_input"]: {
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	date_from?: ModelTypes["date"] | undefined,
	date_to?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	venue?: string | undefined
};
	/** aggregate max on columns */
["FdpPdp_max_fields"]: {
		createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	date_from?: ModelTypes["date"] | undefined,
	date_to?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	venue?: string | undefined
};
	/** aggregate min on columns */
["FdpPdp_min_fields"]: {
		createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	date_from?: ModelTypes["date"] | undefined,
	date_to?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	venue?: string | undefined
};
	/** response of any mutation on the table "FdpPdp" */
["FdpPdp_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["FdpPdp"]>
};
	/** on_conflict condition type for table "FdpPdp" */
["FdpPdp_on_conflict"]: {
	constraint: ModelTypes["FdpPdp_constraint"],
	update_columns: Array<ModelTypes["FdpPdp_update_column"]>,
	where?: ModelTypes["FdpPdp_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "FdpPdp". */
["FdpPdp_order_by"]: {
	createdById?: ModelTypes["order_by"] | undefined,
	created_at?: ModelTypes["order_by"] | undefined,
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
	status?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
	updated_at?: ModelTypes["order_by"] | undefined,
	venue?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: FdpPdp */
["FdpPdp_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["FdpPdp_select_column"]:FdpPdp_select_column;
	/** input type for updating data in table "FdpPdp" */
["FdpPdp_set_input"]: {
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	date_from?: ModelTypes["date"] | undefined,
	date_to?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	venue?: string | undefined
};
	/** Streaming cursor of the table "FdpPdp" */
["FdpPdp_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["FdpPdp_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["FdpPdp_stream_cursor_value_input"]: {
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	date_from?: ModelTypes["date"] | undefined,
	date_to?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	venue?: string | undefined
};
	["FdpPdp_update_column"]:FdpPdp_update_column;
	["FdpPdp_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["FdpPdp_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["FdpPdp_bool_exp"]
};
	/** columns and relationships of "Genesis" */
["Genesis"]: {
		created_at: ModelTypes["timestamp"],
	email_id: string,
	id: ModelTypes["uuid"],
	is_verified: boolean,
	name: string,
	phone: string,
	role: string,
	updated_at: ModelTypes["timestamp"]
};
	/** aggregated selection of "Genesis" */
["Genesis_aggregate"]: {
		aggregate?: ModelTypes["Genesis_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["Genesis"]>
};
	/** aggregate fields of "Genesis" */
["Genesis_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["Genesis_max_fields"] | undefined,
	min?: ModelTypes["Genesis_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "Genesis". All fields are combined with a logical 'AND'. */
["Genesis_bool_exp"]: {
	_and?: Array<ModelTypes["Genesis_bool_exp"]> | undefined,
	_not?: ModelTypes["Genesis_bool_exp"] | undefined,
	_or?: Array<ModelTypes["Genesis_bool_exp"]> | undefined,
	created_at?: ModelTypes["timestamp_comparison_exp"] | undefined,
	email_id?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	is_verified?: ModelTypes["Boolean_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	phone?: ModelTypes["String_comparison_exp"] | undefined,
	role?: ModelTypes["String_comparison_exp"] | undefined,
	updated_at?: ModelTypes["timestamp_comparison_exp"] | undefined
};
	["Genesis_constraint"]:Genesis_constraint;
	/** input type for inserting data into table "Genesis" */
["Genesis_insert_input"]: {
	created_at?: ModelTypes["timestamp"] | undefined,
	email_id?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	is_verified?: boolean | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updated_at?: ModelTypes["timestamp"] | undefined
};
	/** aggregate max on columns */
["Genesis_max_fields"]: {
		created_at?: ModelTypes["timestamp"] | undefined,
	email_id?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updated_at?: ModelTypes["timestamp"] | undefined
};
	/** aggregate min on columns */
["Genesis_min_fields"]: {
		created_at?: ModelTypes["timestamp"] | undefined,
	email_id?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updated_at?: ModelTypes["timestamp"] | undefined
};
	/** response of any mutation on the table "Genesis" */
["Genesis_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["Genesis"]>
};
	/** on_conflict condition type for table "Genesis" */
["Genesis_on_conflict"]: {
	constraint: ModelTypes["Genesis_constraint"],
	update_columns: Array<ModelTypes["Genesis_update_column"]>,
	where?: ModelTypes["Genesis_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "Genesis". */
["Genesis_order_by"]: {
	created_at?: ModelTypes["order_by"] | undefined,
	email_id?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	is_verified?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	phone?: ModelTypes["order_by"] | undefined,
	role?: ModelTypes["order_by"] | undefined,
	updated_at?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: Genesis */
["Genesis_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["Genesis_select_column"]:Genesis_select_column;
	/** input type for updating data in table "Genesis" */
["Genesis_set_input"]: {
	created_at?: ModelTypes["timestamp"] | undefined,
	email_id?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	is_verified?: boolean | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updated_at?: ModelTypes["timestamp"] | undefined
};
	/** Streaming cursor of the table "Genesis" */
["Genesis_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["Genesis_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["Genesis_stream_cursor_value_input"]: {
	created_at?: ModelTypes["timestamp"] | undefined,
	email_id?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	is_verified?: boolean | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updated_at?: ModelTypes["timestamp"] | undefined
};
	["Genesis_update_column"]:Genesis_update_column;
	["Genesis_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["Genesis_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["Genesis_bool_exp"]
};
	/** columns and relationships of "Institute" */
["Institute"]: {
		address: string,
	city: string,
	created_at: ModelTypes["timestamptz"],
	created_by_id: ModelTypes["uuid"],
	cursor_id: string,
	date_of_establishment: ModelTypes["date"],
	id: ModelTypes["uuid"],
	landmark: string,
	name: string,
	pin: string,
	state: string,
	type: string,
	updated_at: ModelTypes["timestamptz"],
	updated_by_id: ModelTypes["uuid"],
	website: string
};
	/** columns and relationships of "InstituteFunding" */
["InstituteFunding"]: {
		amount: string,
	createdById: ModelTypes["uuid"],
	created_at: ModelTypes["timestamptz"],
	cursorId: string,
	id: ModelTypes["uuid"],
	institute_id: ModelTypes["uuid"],
	name: string,
	purpose: string,
	status: string,
	transaction_date: ModelTypes["date"],
	transaction_type: string,
	type: string,
	updatedById: ModelTypes["uuid"],
	updated_at: ModelTypes["timestamptz"]
};
	/** aggregated selection of "InstituteFunding" */
["InstituteFunding_aggregate"]: {
		aggregate?: ModelTypes["InstituteFunding_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["InstituteFunding"]>
};
	/** aggregate fields of "InstituteFunding" */
["InstituteFunding_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["InstituteFunding_max_fields"] | undefined,
	min?: ModelTypes["InstituteFunding_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "InstituteFunding". All fields are combined with a logical 'AND'. */
["InstituteFunding_bool_exp"]: {
	_and?: Array<ModelTypes["InstituteFunding_bool_exp"]> | undefined,
	_not?: ModelTypes["InstituteFunding_bool_exp"] | undefined,
	_or?: Array<ModelTypes["InstituteFunding_bool_exp"]> | undefined,
	amount?: ModelTypes["String_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	created_at?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	cursorId?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	institute_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	purpose?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["String_comparison_exp"] | undefined,
	transaction_date?: ModelTypes["date_comparison_exp"] | undefined,
	transaction_type?: ModelTypes["String_comparison_exp"] | undefined,
	type?: ModelTypes["String_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined,
	updated_at?: ModelTypes["timestamptz_comparison_exp"] | undefined
};
	["InstituteFunding_constraint"]:InstituteFunding_constraint;
	/** input type for inserting data into table "InstituteFunding" */
["InstituteFunding_insert_input"]: {
	amount?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	/** aggregate max on columns */
["InstituteFunding_max_fields"]: {
		amount?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	/** aggregate min on columns */
["InstituteFunding_min_fields"]: {
		amount?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	/** response of any mutation on the table "InstituteFunding" */
["InstituteFunding_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["InstituteFunding"]>
};
	/** on_conflict condition type for table "InstituteFunding" */
["InstituteFunding_on_conflict"]: {
	constraint: ModelTypes["InstituteFunding_constraint"],
	update_columns: Array<ModelTypes["InstituteFunding_update_column"]>,
	where?: ModelTypes["InstituteFunding_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "InstituteFunding". */
["InstituteFunding_order_by"]: {
	amount?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	created_at?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	institute_id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	purpose?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	transaction_date?: ModelTypes["order_by"] | undefined,
	transaction_type?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
	updated_at?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: InstituteFunding */
["InstituteFunding_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["InstituteFunding_select_column"]:InstituteFunding_select_column;
	/** input type for updating data in table "InstituteFunding" */
["InstituteFunding_set_input"]: {
	amount?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	/** Streaming cursor of the table "InstituteFunding" */
["InstituteFunding_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["InstituteFunding_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["InstituteFunding_stream_cursor_value_input"]: {
	amount?: string | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	institute_id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: string | undefined,
	transaction_date?: ModelTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined
};
	["InstituteFunding_update_column"]:InstituteFunding_update_column;
	["InstituteFunding_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["InstituteFunding_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["InstituteFunding_bool_exp"]
};
	/** aggregated selection of "Institute" */
["Institute_aggregate"]: {
		aggregate?: ModelTypes["Institute_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["Institute"]>
};
	/** aggregate fields of "Institute" */
["Institute_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["Institute_max_fields"] | undefined,
	min?: ModelTypes["Institute_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "Institute". All fields are combined with a logical 'AND'. */
["Institute_bool_exp"]: {
	_and?: Array<ModelTypes["Institute_bool_exp"]> | undefined,
	_not?: ModelTypes["Institute_bool_exp"] | undefined,
	_or?: Array<ModelTypes["Institute_bool_exp"]> | undefined,
	address?: ModelTypes["String_comparison_exp"] | undefined,
	city?: ModelTypes["String_comparison_exp"] | undefined,
	created_at?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	created_by_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursor_id?: ModelTypes["String_comparison_exp"] | undefined,
	date_of_establishment?: ModelTypes["date_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	landmark?: ModelTypes["String_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	pin?: ModelTypes["String_comparison_exp"] | undefined,
	state?: ModelTypes["String_comparison_exp"] | undefined,
	type?: ModelTypes["String_comparison_exp"] | undefined,
	updated_at?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updated_by_id?: ModelTypes["uuid_comparison_exp"] | undefined,
	website?: ModelTypes["String_comparison_exp"] | undefined
};
	["Institute_constraint"]:Institute_constraint;
	/** input type for inserting data into table "Institute" */
["Institute_insert_input"]: {
	address?: string | undefined,
	city?: string | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	created_by_id?: ModelTypes["uuid"] | undefined,
	cursor_id?: string | undefined,
	date_of_establishment?: ModelTypes["date"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	updated_by_id?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate max on columns */
["Institute_max_fields"]: {
		address?: string | undefined,
	city?: string | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	created_by_id?: ModelTypes["uuid"] | undefined,
	cursor_id?: string | undefined,
	date_of_establishment?: ModelTypes["date"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	updated_by_id?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate min on columns */
["Institute_min_fields"]: {
		address?: string | undefined,
	city?: string | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	created_by_id?: ModelTypes["uuid"] | undefined,
	cursor_id?: string | undefined,
	date_of_establishment?: ModelTypes["date"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	updated_by_id?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** response of any mutation on the table "Institute" */
["Institute_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["Institute"]>
};
	/** on_conflict condition type for table "Institute" */
["Institute_on_conflict"]: {
	constraint: ModelTypes["Institute_constraint"],
	update_columns: Array<ModelTypes["Institute_update_column"]>,
	where?: ModelTypes["Institute_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "Institute". */
["Institute_order_by"]: {
	address?: ModelTypes["order_by"] | undefined,
	city?: ModelTypes["order_by"] | undefined,
	created_at?: ModelTypes["order_by"] | undefined,
	created_by_id?: ModelTypes["order_by"] | undefined,
	cursor_id?: ModelTypes["order_by"] | undefined,
	date_of_establishment?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	landmark?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	pin?: ModelTypes["order_by"] | undefined,
	state?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updated_at?: ModelTypes["order_by"] | undefined,
	updated_by_id?: ModelTypes["order_by"] | undefined,
	website?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: Institute */
["Institute_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["Institute_select_column"]:Institute_select_column;
	/** input type for updating data in table "Institute" */
["Institute_set_input"]: {
	address?: string | undefined,
	city?: string | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	created_by_id?: ModelTypes["uuid"] | undefined,
	cursor_id?: string | undefined,
	date_of_establishment?: ModelTypes["date"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	updated_by_id?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** Streaming cursor of the table "Institute" */
["Institute_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["Institute_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["Institute_stream_cursor_value_input"]: {
	address?: string | undefined,
	city?: string | undefined,
	created_at?: ModelTypes["timestamptz"] | undefined,
	created_by_id?: ModelTypes["uuid"] | undefined,
	cursor_id?: string | undefined,
	date_of_establishment?: ModelTypes["date"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updated_at?: ModelTypes["timestamptz"] | undefined,
	updated_by_id?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	["Institute_update_column"]:Institute_update_column;
	["Institute_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["Institute_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["Institute_bool_exp"]
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
	/** mutation root */
["mutation_root"]: {
		/** delete data from the table: "EGovernance" */
	delete_EGovernance?: ModelTypes["EGovernance_mutation_response"] | undefined,
	/** delete single row from the table: "EGovernance" */
	delete_EGovernance_by_pk?: ModelTypes["EGovernance"] | undefined,
	/** delete data from the table: "Faculty" */
	delete_Faculty?: ModelTypes["Faculty_mutation_response"] | undefined,
	/** delete data from the table: "FacultyFunding" */
	delete_FacultyFunding?: ModelTypes["FacultyFunding_mutation_response"] | undefined,
	/** delete single row from the table: "FacultyFunding" */
	delete_FacultyFunding_by_pk?: ModelTypes["FacultyFunding"] | undefined,
	/** delete single row from the table: "Faculty" */
	delete_Faculty_by_pk?: ModelTypes["Faculty"] | undefined,
	/** delete data from the table: "FdpPdp" */
	delete_FdpPdp?: ModelTypes["FdpPdp_mutation_response"] | undefined,
	/** delete single row from the table: "FdpPdp" */
	delete_FdpPdp_by_pk?: ModelTypes["FdpPdp"] | undefined,
	/** delete data from the table: "Genesis" */
	delete_Genesis?: ModelTypes["Genesis_mutation_response"] | undefined,
	/** delete single row from the table: "Genesis" */
	delete_Genesis_by_pk?: ModelTypes["Genesis"] | undefined,
	/** delete data from the table: "Institute" */
	delete_Institute?: ModelTypes["Institute_mutation_response"] | undefined,
	/** delete data from the table: "InstituteFunding" */
	delete_InstituteFunding?: ModelTypes["InstituteFunding_mutation_response"] | undefined,
	/** delete single row from the table: "InstituteFunding" */
	delete_InstituteFunding_by_pk?: ModelTypes["InstituteFunding"] | undefined,
	/** delete single row from the table: "Institute" */
	delete_Institute_by_pk?: ModelTypes["Institute"] | undefined,
	/** insert data into the table: "EGovernance" */
	insert_EGovernance?: ModelTypes["EGovernance_mutation_response"] | undefined,
	/** insert a single row into the table: "EGovernance" */
	insert_EGovernance_one?: ModelTypes["EGovernance"] | undefined,
	/** insert data into the table: "Faculty" */
	insert_Faculty?: ModelTypes["Faculty_mutation_response"] | undefined,
	/** insert data into the table: "FacultyFunding" */
	insert_FacultyFunding?: ModelTypes["FacultyFunding_mutation_response"] | undefined,
	/** insert a single row into the table: "FacultyFunding" */
	insert_FacultyFunding_one?: ModelTypes["FacultyFunding"] | undefined,
	/** insert a single row into the table: "Faculty" */
	insert_Faculty_one?: ModelTypes["Faculty"] | undefined,
	/** insert data into the table: "FdpPdp" */
	insert_FdpPdp?: ModelTypes["FdpPdp_mutation_response"] | undefined,
	/** insert a single row into the table: "FdpPdp" */
	insert_FdpPdp_one?: ModelTypes["FdpPdp"] | undefined,
	/** insert data into the table: "Genesis" */
	insert_Genesis?: ModelTypes["Genesis_mutation_response"] | undefined,
	/** insert a single row into the table: "Genesis" */
	insert_Genesis_one?: ModelTypes["Genesis"] | undefined,
	/** insert data into the table: "Institute" */
	insert_Institute?: ModelTypes["Institute_mutation_response"] | undefined,
	/** insert data into the table: "InstituteFunding" */
	insert_InstituteFunding?: ModelTypes["InstituteFunding_mutation_response"] | undefined,
	/** insert a single row into the table: "InstituteFunding" */
	insert_InstituteFunding_one?: ModelTypes["InstituteFunding"] | undefined,
	/** insert a single row into the table: "Institute" */
	insert_Institute_one?: ModelTypes["Institute"] | undefined,
	/** update data of the table: "EGovernance" */
	update_EGovernance?: ModelTypes["EGovernance_mutation_response"] | undefined,
	/** update single row of the table: "EGovernance" */
	update_EGovernance_by_pk?: ModelTypes["EGovernance"] | undefined,
	/** update multiples rows of table: "EGovernance" */
	update_EGovernance_many?: Array<ModelTypes["EGovernance_mutation_response"] | undefined> | undefined,
	/** update data of the table: "Faculty" */
	update_Faculty?: ModelTypes["Faculty_mutation_response"] | undefined,
	/** update data of the table: "FacultyFunding" */
	update_FacultyFunding?: ModelTypes["FacultyFunding_mutation_response"] | undefined,
	/** update single row of the table: "FacultyFunding" */
	update_FacultyFunding_by_pk?: ModelTypes["FacultyFunding"] | undefined,
	/** update multiples rows of table: "FacultyFunding" */
	update_FacultyFunding_many?: Array<ModelTypes["FacultyFunding_mutation_response"] | undefined> | undefined,
	/** update single row of the table: "Faculty" */
	update_Faculty_by_pk?: ModelTypes["Faculty"] | undefined,
	/** update multiples rows of table: "Faculty" */
	update_Faculty_many?: Array<ModelTypes["Faculty_mutation_response"] | undefined> | undefined,
	/** update data of the table: "FdpPdp" */
	update_FdpPdp?: ModelTypes["FdpPdp_mutation_response"] | undefined,
	/** update single row of the table: "FdpPdp" */
	update_FdpPdp_by_pk?: ModelTypes["FdpPdp"] | undefined,
	/** update multiples rows of table: "FdpPdp" */
	update_FdpPdp_many?: Array<ModelTypes["FdpPdp_mutation_response"] | undefined> | undefined,
	/** update data of the table: "Genesis" */
	update_Genesis?: ModelTypes["Genesis_mutation_response"] | undefined,
	/** update single row of the table: "Genesis" */
	update_Genesis_by_pk?: ModelTypes["Genesis"] | undefined,
	/** update multiples rows of table: "Genesis" */
	update_Genesis_many?: Array<ModelTypes["Genesis_mutation_response"] | undefined> | undefined,
	/** update data of the table: "Institute" */
	update_Institute?: ModelTypes["Institute_mutation_response"] | undefined,
	/** update data of the table: "InstituteFunding" */
	update_InstituteFunding?: ModelTypes["InstituteFunding_mutation_response"] | undefined,
	/** update single row of the table: "InstituteFunding" */
	update_InstituteFunding_by_pk?: ModelTypes["InstituteFunding"] | undefined,
	/** update multiples rows of table: "InstituteFunding" */
	update_InstituteFunding_many?: Array<ModelTypes["InstituteFunding_mutation_response"] | undefined> | undefined,
	/** update single row of the table: "Institute" */
	update_Institute_by_pk?: ModelTypes["Institute"] | undefined,
	/** update multiples rows of table: "Institute" */
	update_Institute_many?: Array<ModelTypes["Institute_mutation_response"] | undefined> | undefined
};
	["order_by"]:order_by;
	["query_root"]: {
		/** fetch data from the table: "EGovernance" */
	EGovernance: Array<ModelTypes["EGovernance"]>,
	/** fetch aggregated fields from the table: "EGovernance" */
	EGovernance_aggregate: ModelTypes["EGovernance_aggregate"],
	/** fetch data from the table: "EGovernance" using primary key columns */
	EGovernance_by_pk?: ModelTypes["EGovernance"] | undefined,
	/** fetch data from the table: "Faculty" */
	Faculty: Array<ModelTypes["Faculty"]>,
	/** fetch data from the table: "FacultyFunding" */
	FacultyFunding: Array<ModelTypes["FacultyFunding"]>,
	/** fetch aggregated fields from the table: "FacultyFunding" */
	FacultyFunding_aggregate: ModelTypes["FacultyFunding_aggregate"],
	/** fetch data from the table: "FacultyFunding" using primary key columns */
	FacultyFunding_by_pk?: ModelTypes["FacultyFunding"] | undefined,
	/** fetch aggregated fields from the table: "Faculty" */
	Faculty_aggregate: ModelTypes["Faculty_aggregate"],
	/** fetch data from the table: "Faculty" using primary key columns */
	Faculty_by_pk?: ModelTypes["Faculty"] | undefined,
	/** fetch data from the table: "FdpPdp" */
	FdpPdp: Array<ModelTypes["FdpPdp"]>,
	/** fetch aggregated fields from the table: "FdpPdp" */
	FdpPdp_aggregate: ModelTypes["FdpPdp_aggregate"],
	/** fetch data from the table: "FdpPdp" using primary key columns */
	FdpPdp_by_pk?: ModelTypes["FdpPdp"] | undefined,
	/** fetch data from the table: "Genesis" */
	Genesis: Array<ModelTypes["Genesis"]>,
	/** fetch aggregated fields from the table: "Genesis" */
	Genesis_aggregate: ModelTypes["Genesis_aggregate"],
	/** fetch data from the table: "Genesis" using primary key columns */
	Genesis_by_pk?: ModelTypes["Genesis"] | undefined,
	/** fetch data from the table: "Institute" */
	Institute: Array<ModelTypes["Institute"]>,
	/** fetch data from the table: "InstituteFunding" */
	InstituteFunding: Array<ModelTypes["InstituteFunding"]>,
	/** fetch aggregated fields from the table: "InstituteFunding" */
	InstituteFunding_aggregate: ModelTypes["InstituteFunding_aggregate"],
	/** fetch data from the table: "InstituteFunding" using primary key columns */
	InstituteFunding_by_pk?: ModelTypes["InstituteFunding"] | undefined,
	/** fetch aggregated fields from the table: "Institute" */
	Institute_aggregate: ModelTypes["Institute_aggregate"],
	/** fetch data from the table: "Institute" using primary key columns */
	Institute_by_pk?: ModelTypes["Institute"] | undefined
};
	["subscription_root"]: {
		/** fetch data from the table: "EGovernance" */
	EGovernance: Array<ModelTypes["EGovernance"]>,
	/** fetch aggregated fields from the table: "EGovernance" */
	EGovernance_aggregate: ModelTypes["EGovernance_aggregate"],
	/** fetch data from the table: "EGovernance" using primary key columns */
	EGovernance_by_pk?: ModelTypes["EGovernance"] | undefined,
	/** fetch data from the table in a streaming manner: "EGovernance" */
	EGovernance_stream: Array<ModelTypes["EGovernance"]>,
	/** fetch data from the table: "Faculty" */
	Faculty: Array<ModelTypes["Faculty"]>,
	/** fetch data from the table: "FacultyFunding" */
	FacultyFunding: Array<ModelTypes["FacultyFunding"]>,
	/** fetch aggregated fields from the table: "FacultyFunding" */
	FacultyFunding_aggregate: ModelTypes["FacultyFunding_aggregate"],
	/** fetch data from the table: "FacultyFunding" using primary key columns */
	FacultyFunding_by_pk?: ModelTypes["FacultyFunding"] | undefined,
	/** fetch data from the table in a streaming manner: "FacultyFunding" */
	FacultyFunding_stream: Array<ModelTypes["FacultyFunding"]>,
	/** fetch aggregated fields from the table: "Faculty" */
	Faculty_aggregate: ModelTypes["Faculty_aggregate"],
	/** fetch data from the table: "Faculty" using primary key columns */
	Faculty_by_pk?: ModelTypes["Faculty"] | undefined,
	/** fetch data from the table in a streaming manner: "Faculty" */
	Faculty_stream: Array<ModelTypes["Faculty"]>,
	/** fetch data from the table: "FdpPdp" */
	FdpPdp: Array<ModelTypes["FdpPdp"]>,
	/** fetch aggregated fields from the table: "FdpPdp" */
	FdpPdp_aggregate: ModelTypes["FdpPdp_aggregate"],
	/** fetch data from the table: "FdpPdp" using primary key columns */
	FdpPdp_by_pk?: ModelTypes["FdpPdp"] | undefined,
	/** fetch data from the table in a streaming manner: "FdpPdp" */
	FdpPdp_stream: Array<ModelTypes["FdpPdp"]>,
	/** fetch data from the table: "Genesis" */
	Genesis: Array<ModelTypes["Genesis"]>,
	/** fetch aggregated fields from the table: "Genesis" */
	Genesis_aggregate: ModelTypes["Genesis_aggregate"],
	/** fetch data from the table: "Genesis" using primary key columns */
	Genesis_by_pk?: ModelTypes["Genesis"] | undefined,
	/** fetch data from the table in a streaming manner: "Genesis" */
	Genesis_stream: Array<ModelTypes["Genesis"]>,
	/** fetch data from the table: "Institute" */
	Institute: Array<ModelTypes["Institute"]>,
	/** fetch data from the table: "InstituteFunding" */
	InstituteFunding: Array<ModelTypes["InstituteFunding"]>,
	/** fetch aggregated fields from the table: "InstituteFunding" */
	InstituteFunding_aggregate: ModelTypes["InstituteFunding_aggregate"],
	/** fetch data from the table: "InstituteFunding" using primary key columns */
	InstituteFunding_by_pk?: ModelTypes["InstituteFunding"] | undefined,
	/** fetch data from the table in a streaming manner: "InstituteFunding" */
	InstituteFunding_stream: Array<ModelTypes["InstituteFunding"]>,
	/** fetch aggregated fields from the table: "Institute" */
	Institute_aggregate: ModelTypes["Institute_aggregate"],
	/** fetch data from the table: "Institute" using primary key columns */
	Institute_by_pk?: ModelTypes["Institute"] | undefined,
	/** fetch data from the table in a streaming manner: "Institute" */
	Institute_stream: Array<ModelTypes["Institute"]>
};
	["timestamp"]:any;
	/** Boolean expression to compare columns of type "timestamp". All fields are combined with logical 'AND'. */
["timestamp_comparison_exp"]: {
	_eq?: ModelTypes["timestamp"] | undefined,
	_gt?: ModelTypes["timestamp"] | undefined,
	_gte?: ModelTypes["timestamp"] | undefined,
	_in?: Array<ModelTypes["timestamp"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: ModelTypes["timestamp"] | undefined,
	_lte?: ModelTypes["timestamp"] | undefined,
	_neq?: ModelTypes["timestamp"] | undefined,
	_nin?: Array<ModelTypes["timestamp"]> | undefined
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
    /** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
["Boolean_comparison_exp"]: {
		_eq?: boolean | undefined,
	_gt?: boolean | undefined,
	_gte?: boolean | undefined,
	_in?: Array<boolean> | undefined,
	_is_null?: boolean | undefined,
	_lt?: boolean | undefined,
	_lte?: boolean | undefined,
	_neq?: boolean | undefined,
	_nin?: Array<boolean> | undefined
};
	/** columns and relationships of "EGovernance" */
["EGovernance"]: {
	__typename: "EGovernance",
	address: string,
	area: string,
	createdById: GraphQLTypes["uuid"],
	created_at: GraphQLTypes["timestamptz"],
	cursorId: string,
	description: string,
	file: string,
	id: GraphQLTypes["uuid"],
	institute_id: GraphQLTypes["uuid"],
	name: string,
	phone_no: string,
	service_end_date: GraphQLTypes["date"],
	service_start_date: GraphQLTypes["date"],
	status: string,
	total_amount: string,
	updatedById: GraphQLTypes["uuid"],
	updated_at: GraphQLTypes["timestamptz"],
	website: string
};
	/** aggregated selection of "EGovernance" */
["EGovernance_aggregate"]: {
	__typename: "EGovernance_aggregate",
	aggregate?: GraphQLTypes["EGovernance_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["EGovernance"]>
};
	/** aggregate fields of "EGovernance" */
["EGovernance_aggregate_fields"]: {
	__typename: "EGovernance_aggregate_fields",
	count: number,
	max?: GraphQLTypes["EGovernance_max_fields"] | undefined,
	min?: GraphQLTypes["EGovernance_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "EGovernance". All fields are combined with a logical 'AND'. */
["EGovernance_bool_exp"]: {
		_and?: Array<GraphQLTypes["EGovernance_bool_exp"]> | undefined,
	_not?: GraphQLTypes["EGovernance_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["EGovernance_bool_exp"]> | undefined,
	address?: GraphQLTypes["String_comparison_exp"] | undefined,
	area?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	created_at?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["String_comparison_exp"] | undefined,
	description?: GraphQLTypes["String_comparison_exp"] | undefined,
	file?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	institute_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	phone_no?: GraphQLTypes["String_comparison_exp"] | undefined,
	service_end_date?: GraphQLTypes["date_comparison_exp"] | undefined,
	service_start_date?: GraphQLTypes["date_comparison_exp"] | undefined,
	status?: GraphQLTypes["String_comparison_exp"] | undefined,
	total_amount?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	updated_at?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	website?: GraphQLTypes["String_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "EGovernance" */
["EGovernance_constraint"]: EGovernance_constraint;
	/** input type for inserting data into table "EGovernance" */
["EGovernance_insert_input"]: {
		address?: string | undefined,
	area?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: GraphQLTypes["date"] | undefined,
	service_start_date?: GraphQLTypes["date"] | undefined,
	status?: string | undefined,
	total_amount?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	website?: string | undefined
};
	/** aggregate max on columns */
["EGovernance_max_fields"]: {
	__typename: "EGovernance_max_fields",
	address?: string | undefined,
	area?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: GraphQLTypes["date"] | undefined,
	service_start_date?: GraphQLTypes["date"] | undefined,
	status?: string | undefined,
	total_amount?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	website?: string | undefined
};
	/** aggregate min on columns */
["EGovernance_min_fields"]: {
	__typename: "EGovernance_min_fields",
	address?: string | undefined,
	area?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: GraphQLTypes["date"] | undefined,
	service_start_date?: GraphQLTypes["date"] | undefined,
	status?: string | undefined,
	total_amount?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	website?: string | undefined
};
	/** response of any mutation on the table "EGovernance" */
["EGovernance_mutation_response"]: {
	__typename: "EGovernance_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["EGovernance"]>
};
	/** on_conflict condition type for table "EGovernance" */
["EGovernance_on_conflict"]: {
		constraint: GraphQLTypes["EGovernance_constraint"],
	update_columns: Array<GraphQLTypes["EGovernance_update_column"]>,
	where?: GraphQLTypes["EGovernance_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "EGovernance". */
["EGovernance_order_by"]: {
		address?: GraphQLTypes["order_by"] | undefined,
	area?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	created_at?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	description?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	phone_no?: GraphQLTypes["order_by"] | undefined,
	service_end_date?: GraphQLTypes["order_by"] | undefined,
	service_start_date?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	total_amount?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
	updated_at?: GraphQLTypes["order_by"] | undefined,
	website?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: EGovernance */
["EGovernance_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "EGovernance" */
["EGovernance_select_column"]: EGovernance_select_column;
	/** input type for updating data in table "EGovernance" */
["EGovernance_set_input"]: {
		address?: string | undefined,
	area?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: GraphQLTypes["date"] | undefined,
	service_start_date?: GraphQLTypes["date"] | undefined,
	status?: string | undefined,
	total_amount?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	website?: string | undefined
};
	/** Streaming cursor of the table "EGovernance" */
["EGovernance_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["EGovernance_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["EGovernance_stream_cursor_value_input"]: {
		address?: string | undefined,
	area?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phone_no?: string | undefined,
	service_end_date?: GraphQLTypes["date"] | undefined,
	service_start_date?: GraphQLTypes["date"] | undefined,
	status?: string | undefined,
	total_amount?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	website?: string | undefined
};
	/** update columns of table "EGovernance" */
["EGovernance_update_column"]: EGovernance_update_column;
	["EGovernance_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["EGovernance_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["EGovernance_bool_exp"]
};
	/** columns and relationships of "Faculty" */
["Faculty"]: {
	__typename: "Faculty",
	address: string,
	cast: string,
	createdById: GraphQLTypes["uuid"],
	created_at: GraphQLTypes["timestamptz"],
	cursorId: string,
	date_of_joining: GraphQLTypes["date"],
	designation: string,
	dob: GraphQLTypes["date"],
	email_id: string,
	experience: string,
	gender: string,
	id: GraphQLTypes["uuid"],
	institute_id: GraphQLTypes["uuid"],
	job_type: string,
	minority: string,
	name: string,
	pan_card_no: string,
	phone: string,
	qualification: string,
	section: string,
	staff_type: string,
	status: string,
	status_of_approval: string,
	updatedById: GraphQLTypes["uuid"],
	updated_at: GraphQLTypes["timestamptz"]
};
	/** columns and relationships of "FacultyFunding" */
["FacultyFunding"]: {
	__typename: "FacultyFunding",
	amount: string,
	createdById: GraphQLTypes["uuid"],
	created_at: GraphQLTypes["timestamptz"],
	cursorId: string,
	faculty_id: GraphQLTypes["uuid"],
	file: string,
	id: GraphQLTypes["uuid"],
	institute_id: GraphQLTypes["uuid"],
	nature: string,
	status: string,
	transaction_date: GraphQLTypes["date"],
	transaction_type: string,
	type: string,
	updatedById: GraphQLTypes["uuid"],
	updated_at: GraphQLTypes["timestamptz"]
};
	/** aggregated selection of "FacultyFunding" */
["FacultyFunding_aggregate"]: {
	__typename: "FacultyFunding_aggregate",
	aggregate?: GraphQLTypes["FacultyFunding_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["FacultyFunding"]>
};
	/** aggregate fields of "FacultyFunding" */
["FacultyFunding_aggregate_fields"]: {
	__typename: "FacultyFunding_aggregate_fields",
	count: number,
	max?: GraphQLTypes["FacultyFunding_max_fields"] | undefined,
	min?: GraphQLTypes["FacultyFunding_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "FacultyFunding". All fields are combined with a logical 'AND'. */
["FacultyFunding_bool_exp"]: {
		_and?: Array<GraphQLTypes["FacultyFunding_bool_exp"]> | undefined,
	_not?: GraphQLTypes["FacultyFunding_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["FacultyFunding_bool_exp"]> | undefined,
	amount?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	created_at?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["String_comparison_exp"] | undefined,
	faculty_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	file?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	institute_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	nature?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["String_comparison_exp"] | undefined,
	transaction_date?: GraphQLTypes["date_comparison_exp"] | undefined,
	transaction_type?: GraphQLTypes["String_comparison_exp"] | undefined,
	type?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	updated_at?: GraphQLTypes["timestamptz_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "FacultyFunding" */
["FacultyFunding_constraint"]: FacultyFunding_constraint;
	/** input type for inserting data into table "FacultyFunding" */
["FacultyFunding_insert_input"]: {
		amount?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** aggregate max on columns */
["FacultyFunding_max_fields"]: {
	__typename: "FacultyFunding_max_fields",
	amount?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** aggregate min on columns */
["FacultyFunding_min_fields"]: {
	__typename: "FacultyFunding_min_fields",
	amount?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** response of any mutation on the table "FacultyFunding" */
["FacultyFunding_mutation_response"]: {
	__typename: "FacultyFunding_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["FacultyFunding"]>
};
	/** on_conflict condition type for table "FacultyFunding" */
["FacultyFunding_on_conflict"]: {
		constraint: GraphQLTypes["FacultyFunding_constraint"],
	update_columns: Array<GraphQLTypes["FacultyFunding_update_column"]>,
	where?: GraphQLTypes["FacultyFunding_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "FacultyFunding". */
["FacultyFunding_order_by"]: {
		amount?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	created_at?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	faculty_id?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	nature?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	transaction_date?: GraphQLTypes["order_by"] | undefined,
	transaction_type?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
	updated_at?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: FacultyFunding */
["FacultyFunding_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "FacultyFunding" */
["FacultyFunding_select_column"]: FacultyFunding_select_column;
	/** input type for updating data in table "FacultyFunding" */
["FacultyFunding_set_input"]: {
		amount?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** Streaming cursor of the table "FacultyFunding" */
["FacultyFunding_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["FacultyFunding_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["FacultyFunding_stream_cursor_value_input"]: {
		amount?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** update columns of table "FacultyFunding" */
["FacultyFunding_update_column"]: FacultyFunding_update_column;
	["FacultyFunding_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["FacultyFunding_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["FacultyFunding_bool_exp"]
};
	/** aggregated selection of "Faculty" */
["Faculty_aggregate"]: {
	__typename: "Faculty_aggregate",
	aggregate?: GraphQLTypes["Faculty_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["Faculty"]>
};
	/** aggregate fields of "Faculty" */
["Faculty_aggregate_fields"]: {
	__typename: "Faculty_aggregate_fields",
	count: number,
	max?: GraphQLTypes["Faculty_max_fields"] | undefined,
	min?: GraphQLTypes["Faculty_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "Faculty". All fields are combined with a logical 'AND'. */
["Faculty_bool_exp"]: {
		_and?: Array<GraphQLTypes["Faculty_bool_exp"]> | undefined,
	_not?: GraphQLTypes["Faculty_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["Faculty_bool_exp"]> | undefined,
	address?: GraphQLTypes["String_comparison_exp"] | undefined,
	cast?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	created_at?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["String_comparison_exp"] | undefined,
	date_of_joining?: GraphQLTypes["date_comparison_exp"] | undefined,
	designation?: GraphQLTypes["String_comparison_exp"] | undefined,
	dob?: GraphQLTypes["date_comparison_exp"] | undefined,
	email_id?: GraphQLTypes["String_comparison_exp"] | undefined,
	experience?: GraphQLTypes["String_comparison_exp"] | undefined,
	gender?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	institute_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	job_type?: GraphQLTypes["String_comparison_exp"] | undefined,
	minority?: GraphQLTypes["String_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	pan_card_no?: GraphQLTypes["String_comparison_exp"] | undefined,
	phone?: GraphQLTypes["String_comparison_exp"] | undefined,
	qualification?: GraphQLTypes["String_comparison_exp"] | undefined,
	section?: GraphQLTypes["String_comparison_exp"] | undefined,
	staff_type?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["String_comparison_exp"] | undefined,
	status_of_approval?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	updated_at?: GraphQLTypes["timestamptz_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "Faculty" */
["Faculty_constraint"]: Faculty_constraint;
	/** input type for inserting data into table "Faculty" */
["Faculty_insert_input"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
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
	status?: string | undefined,
	status_of_approval?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** aggregate max on columns */
["Faculty_max_fields"]: {
	__typename: "Faculty_max_fields",
	address?: string | undefined,
	cast?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
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
	status?: string | undefined,
	status_of_approval?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** aggregate min on columns */
["Faculty_min_fields"]: {
	__typename: "Faculty_min_fields",
	address?: string | undefined,
	cast?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
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
	status?: string | undefined,
	status_of_approval?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** response of any mutation on the table "Faculty" */
["Faculty_mutation_response"]: {
	__typename: "Faculty_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["Faculty"]>
};
	/** on_conflict condition type for table "Faculty" */
["Faculty_on_conflict"]: {
		constraint: GraphQLTypes["Faculty_constraint"],
	update_columns: Array<GraphQLTypes["Faculty_update_column"]>,
	where?: GraphQLTypes["Faculty_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "Faculty". */
["Faculty_order_by"]: {
		address?: GraphQLTypes["order_by"] | undefined,
	cast?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	created_at?: GraphQLTypes["order_by"] | undefined,
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
	status?: GraphQLTypes["order_by"] | undefined,
	status_of_approval?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
	updated_at?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: Faculty */
["Faculty_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "Faculty" */
["Faculty_select_column"]: Faculty_select_column;
	/** input type for updating data in table "Faculty" */
["Faculty_set_input"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
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
	status?: string | undefined,
	status_of_approval?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** Streaming cursor of the table "Faculty" */
["Faculty_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["Faculty_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["Faculty_stream_cursor_value_input"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
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
	status?: string | undefined,
	status_of_approval?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** update columns of table "Faculty" */
["Faculty_update_column"]: Faculty_update_column;
	["Faculty_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["Faculty_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["Faculty_bool_exp"]
};
	/** columns and relationships of "FdpPdp" */
["FdpPdp"]: {
	__typename: "FdpPdp",
	createdById: GraphQLTypes["uuid"],
	created_at: GraphQLTypes["timestamptz"],
	cursorId: string,
	date_from: GraphQLTypes["date"],
	date_to: GraphQLTypes["date"],
	description: string,
	faculty_id: GraphQLTypes["uuid"],
	file: string,
	id: GraphQLTypes["uuid"],
	institute_id: GraphQLTypes["uuid"],
	name: string,
	nature: string,
	status: string,
	type: string,
	updatedById: GraphQLTypes["uuid"],
	updated_at: GraphQLTypes["timestamptz"],
	venue: string
};
	/** aggregated selection of "FdpPdp" */
["FdpPdp_aggregate"]: {
	__typename: "FdpPdp_aggregate",
	aggregate?: GraphQLTypes["FdpPdp_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["FdpPdp"]>
};
	/** aggregate fields of "FdpPdp" */
["FdpPdp_aggregate_fields"]: {
	__typename: "FdpPdp_aggregate_fields",
	count: number,
	max?: GraphQLTypes["FdpPdp_max_fields"] | undefined,
	min?: GraphQLTypes["FdpPdp_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "FdpPdp". All fields are combined with a logical 'AND'. */
["FdpPdp_bool_exp"]: {
		_and?: Array<GraphQLTypes["FdpPdp_bool_exp"]> | undefined,
	_not?: GraphQLTypes["FdpPdp_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["FdpPdp_bool_exp"]> | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	created_at?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["String_comparison_exp"] | undefined,
	date_from?: GraphQLTypes["date_comparison_exp"] | undefined,
	date_to?: GraphQLTypes["date_comparison_exp"] | undefined,
	description?: GraphQLTypes["String_comparison_exp"] | undefined,
	faculty_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	file?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	institute_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	nature?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["String_comparison_exp"] | undefined,
	type?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	updated_at?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	venue?: GraphQLTypes["String_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "FdpPdp" */
["FdpPdp_constraint"]: FdpPdp_constraint;
	/** input type for inserting data into table "FdpPdp" */
["FdpPdp_insert_input"]: {
		createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	date_from?: GraphQLTypes["date"] | undefined,
	date_to?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	venue?: string | undefined
};
	/** aggregate max on columns */
["FdpPdp_max_fields"]: {
	__typename: "FdpPdp_max_fields",
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	date_from?: GraphQLTypes["date"] | undefined,
	date_to?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	venue?: string | undefined
};
	/** aggregate min on columns */
["FdpPdp_min_fields"]: {
	__typename: "FdpPdp_min_fields",
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	date_from?: GraphQLTypes["date"] | undefined,
	date_to?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	venue?: string | undefined
};
	/** response of any mutation on the table "FdpPdp" */
["FdpPdp_mutation_response"]: {
	__typename: "FdpPdp_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["FdpPdp"]>
};
	/** on_conflict condition type for table "FdpPdp" */
["FdpPdp_on_conflict"]: {
		constraint: GraphQLTypes["FdpPdp_constraint"],
	update_columns: Array<GraphQLTypes["FdpPdp_update_column"]>,
	where?: GraphQLTypes["FdpPdp_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "FdpPdp". */
["FdpPdp_order_by"]: {
		createdById?: GraphQLTypes["order_by"] | undefined,
	created_at?: GraphQLTypes["order_by"] | undefined,
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
	status?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
	updated_at?: GraphQLTypes["order_by"] | undefined,
	venue?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: FdpPdp */
["FdpPdp_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "FdpPdp" */
["FdpPdp_select_column"]: FdpPdp_select_column;
	/** input type for updating data in table "FdpPdp" */
["FdpPdp_set_input"]: {
		createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	date_from?: GraphQLTypes["date"] | undefined,
	date_to?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	venue?: string | undefined
};
	/** Streaming cursor of the table "FdpPdp" */
["FdpPdp_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["FdpPdp_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["FdpPdp_stream_cursor_value_input"]: {
		createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	date_from?: GraphQLTypes["date"] | undefined,
	date_to?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	faculty_id?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	venue?: string | undefined
};
	/** update columns of table "FdpPdp" */
["FdpPdp_update_column"]: FdpPdp_update_column;
	["FdpPdp_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["FdpPdp_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["FdpPdp_bool_exp"]
};
	/** columns and relationships of "Genesis" */
["Genesis"]: {
	__typename: "Genesis",
	created_at: GraphQLTypes["timestamp"],
	email_id: string,
	id: GraphQLTypes["uuid"],
	is_verified: boolean,
	name: string,
	phone: string,
	role: string,
	updated_at: GraphQLTypes["timestamp"]
};
	/** aggregated selection of "Genesis" */
["Genesis_aggregate"]: {
	__typename: "Genesis_aggregate",
	aggregate?: GraphQLTypes["Genesis_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["Genesis"]>
};
	/** aggregate fields of "Genesis" */
["Genesis_aggregate_fields"]: {
	__typename: "Genesis_aggregate_fields",
	count: number,
	max?: GraphQLTypes["Genesis_max_fields"] | undefined,
	min?: GraphQLTypes["Genesis_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "Genesis". All fields are combined with a logical 'AND'. */
["Genesis_bool_exp"]: {
		_and?: Array<GraphQLTypes["Genesis_bool_exp"]> | undefined,
	_not?: GraphQLTypes["Genesis_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["Genesis_bool_exp"]> | undefined,
	created_at?: GraphQLTypes["timestamp_comparison_exp"] | undefined,
	email_id?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	is_verified?: GraphQLTypes["Boolean_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	phone?: GraphQLTypes["String_comparison_exp"] | undefined,
	role?: GraphQLTypes["String_comparison_exp"] | undefined,
	updated_at?: GraphQLTypes["timestamp_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "Genesis" */
["Genesis_constraint"]: Genesis_constraint;
	/** input type for inserting data into table "Genesis" */
["Genesis_insert_input"]: {
		created_at?: GraphQLTypes["timestamp"] | undefined,
	email_id?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	is_verified?: boolean | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updated_at?: GraphQLTypes["timestamp"] | undefined
};
	/** aggregate max on columns */
["Genesis_max_fields"]: {
	__typename: "Genesis_max_fields",
	created_at?: GraphQLTypes["timestamp"] | undefined,
	email_id?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updated_at?: GraphQLTypes["timestamp"] | undefined
};
	/** aggregate min on columns */
["Genesis_min_fields"]: {
	__typename: "Genesis_min_fields",
	created_at?: GraphQLTypes["timestamp"] | undefined,
	email_id?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updated_at?: GraphQLTypes["timestamp"] | undefined
};
	/** response of any mutation on the table "Genesis" */
["Genesis_mutation_response"]: {
	__typename: "Genesis_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["Genesis"]>
};
	/** on_conflict condition type for table "Genesis" */
["Genesis_on_conflict"]: {
		constraint: GraphQLTypes["Genesis_constraint"],
	update_columns: Array<GraphQLTypes["Genesis_update_column"]>,
	where?: GraphQLTypes["Genesis_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "Genesis". */
["Genesis_order_by"]: {
		created_at?: GraphQLTypes["order_by"] | undefined,
	email_id?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	is_verified?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	phone?: GraphQLTypes["order_by"] | undefined,
	role?: GraphQLTypes["order_by"] | undefined,
	updated_at?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: Genesis */
["Genesis_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "Genesis" */
["Genesis_select_column"]: Genesis_select_column;
	/** input type for updating data in table "Genesis" */
["Genesis_set_input"]: {
		created_at?: GraphQLTypes["timestamp"] | undefined,
	email_id?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	is_verified?: boolean | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updated_at?: GraphQLTypes["timestamp"] | undefined
};
	/** Streaming cursor of the table "Genesis" */
["Genesis_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["Genesis_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["Genesis_stream_cursor_value_input"]: {
		created_at?: GraphQLTypes["timestamp"] | undefined,
	email_id?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	is_verified?: boolean | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	role?: string | undefined,
	updated_at?: GraphQLTypes["timestamp"] | undefined
};
	/** update columns of table "Genesis" */
["Genesis_update_column"]: Genesis_update_column;
	["Genesis_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["Genesis_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["Genesis_bool_exp"]
};
	/** columns and relationships of "Institute" */
["Institute"]: {
	__typename: "Institute",
	address: string,
	city: string,
	created_at: GraphQLTypes["timestamptz"],
	created_by_id: GraphQLTypes["uuid"],
	cursor_id: string,
	date_of_establishment: GraphQLTypes["date"],
	id: GraphQLTypes["uuid"],
	landmark: string,
	name: string,
	pin: string,
	state: string,
	type: string,
	updated_at: GraphQLTypes["timestamptz"],
	updated_by_id: GraphQLTypes["uuid"],
	website: string
};
	/** columns and relationships of "InstituteFunding" */
["InstituteFunding"]: {
	__typename: "InstituteFunding",
	amount: string,
	createdById: GraphQLTypes["uuid"],
	created_at: GraphQLTypes["timestamptz"],
	cursorId: string,
	id: GraphQLTypes["uuid"],
	institute_id: GraphQLTypes["uuid"],
	name: string,
	purpose: string,
	status: string,
	transaction_date: GraphQLTypes["date"],
	transaction_type: string,
	type: string,
	updatedById: GraphQLTypes["uuid"],
	updated_at: GraphQLTypes["timestamptz"]
};
	/** aggregated selection of "InstituteFunding" */
["InstituteFunding_aggregate"]: {
	__typename: "InstituteFunding_aggregate",
	aggregate?: GraphQLTypes["InstituteFunding_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["InstituteFunding"]>
};
	/** aggregate fields of "InstituteFunding" */
["InstituteFunding_aggregate_fields"]: {
	__typename: "InstituteFunding_aggregate_fields",
	count: number,
	max?: GraphQLTypes["InstituteFunding_max_fields"] | undefined,
	min?: GraphQLTypes["InstituteFunding_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "InstituteFunding". All fields are combined with a logical 'AND'. */
["InstituteFunding_bool_exp"]: {
		_and?: Array<GraphQLTypes["InstituteFunding_bool_exp"]> | undefined,
	_not?: GraphQLTypes["InstituteFunding_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["InstituteFunding_bool_exp"]> | undefined,
	amount?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	created_at?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	institute_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	purpose?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["String_comparison_exp"] | undefined,
	transaction_date?: GraphQLTypes["date_comparison_exp"] | undefined,
	transaction_type?: GraphQLTypes["String_comparison_exp"] | undefined,
	type?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	updated_at?: GraphQLTypes["timestamptz_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "InstituteFunding" */
["InstituteFunding_constraint"]: InstituteFunding_constraint;
	/** input type for inserting data into table "InstituteFunding" */
["InstituteFunding_insert_input"]: {
		amount?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** aggregate max on columns */
["InstituteFunding_max_fields"]: {
	__typename: "InstituteFunding_max_fields",
	amount?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** aggregate min on columns */
["InstituteFunding_min_fields"]: {
	__typename: "InstituteFunding_min_fields",
	amount?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** response of any mutation on the table "InstituteFunding" */
["InstituteFunding_mutation_response"]: {
	__typename: "InstituteFunding_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["InstituteFunding"]>
};
	/** on_conflict condition type for table "InstituteFunding" */
["InstituteFunding_on_conflict"]: {
		constraint: GraphQLTypes["InstituteFunding_constraint"],
	update_columns: Array<GraphQLTypes["InstituteFunding_update_column"]>,
	where?: GraphQLTypes["InstituteFunding_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "InstituteFunding". */
["InstituteFunding_order_by"]: {
		amount?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	created_at?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	institute_id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	purpose?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	transaction_date?: GraphQLTypes["order_by"] | undefined,
	transaction_type?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
	updated_at?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: InstituteFunding */
["InstituteFunding_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "InstituteFunding" */
["InstituteFunding_select_column"]: InstituteFunding_select_column;
	/** input type for updating data in table "InstituteFunding" */
["InstituteFunding_set_input"]: {
		amount?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** Streaming cursor of the table "InstituteFunding" */
["InstituteFunding_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["InstituteFunding_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["InstituteFunding_stream_cursor_value_input"]: {
		amount?: string | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	cursorId?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	institute_id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: string | undefined,
	transaction_date?: GraphQLTypes["date"] | undefined,
	transaction_type?: string | undefined,
	type?: string | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined
};
	/** update columns of table "InstituteFunding" */
["InstituteFunding_update_column"]: InstituteFunding_update_column;
	["InstituteFunding_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["InstituteFunding_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["InstituteFunding_bool_exp"]
};
	/** aggregated selection of "Institute" */
["Institute_aggregate"]: {
	__typename: "Institute_aggregate",
	aggregate?: GraphQLTypes["Institute_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["Institute"]>
};
	/** aggregate fields of "Institute" */
["Institute_aggregate_fields"]: {
	__typename: "Institute_aggregate_fields",
	count: number,
	max?: GraphQLTypes["Institute_max_fields"] | undefined,
	min?: GraphQLTypes["Institute_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "Institute". All fields are combined with a logical 'AND'. */
["Institute_bool_exp"]: {
		_and?: Array<GraphQLTypes["Institute_bool_exp"]> | undefined,
	_not?: GraphQLTypes["Institute_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["Institute_bool_exp"]> | undefined,
	address?: GraphQLTypes["String_comparison_exp"] | undefined,
	city?: GraphQLTypes["String_comparison_exp"] | undefined,
	created_at?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	created_by_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursor_id?: GraphQLTypes["String_comparison_exp"] | undefined,
	date_of_establishment?: GraphQLTypes["date_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	landmark?: GraphQLTypes["String_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	pin?: GraphQLTypes["String_comparison_exp"] | undefined,
	state?: GraphQLTypes["String_comparison_exp"] | undefined,
	type?: GraphQLTypes["String_comparison_exp"] | undefined,
	updated_at?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updated_by_id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	website?: GraphQLTypes["String_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "Institute" */
["Institute_constraint"]: Institute_constraint;
	/** input type for inserting data into table "Institute" */
["Institute_insert_input"]: {
		address?: string | undefined,
	city?: string | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	created_by_id?: GraphQLTypes["uuid"] | undefined,
	cursor_id?: string | undefined,
	date_of_establishment?: GraphQLTypes["date"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	updated_by_id?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate max on columns */
["Institute_max_fields"]: {
	__typename: "Institute_max_fields",
	address?: string | undefined,
	city?: string | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	created_by_id?: GraphQLTypes["uuid"] | undefined,
	cursor_id?: string | undefined,
	date_of_establishment?: GraphQLTypes["date"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	updated_by_id?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate min on columns */
["Institute_min_fields"]: {
	__typename: "Institute_min_fields",
	address?: string | undefined,
	city?: string | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	created_by_id?: GraphQLTypes["uuid"] | undefined,
	cursor_id?: string | undefined,
	date_of_establishment?: GraphQLTypes["date"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	updated_by_id?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** response of any mutation on the table "Institute" */
["Institute_mutation_response"]: {
	__typename: "Institute_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["Institute"]>
};
	/** on_conflict condition type for table "Institute" */
["Institute_on_conflict"]: {
		constraint: GraphQLTypes["Institute_constraint"],
	update_columns: Array<GraphQLTypes["Institute_update_column"]>,
	where?: GraphQLTypes["Institute_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "Institute". */
["Institute_order_by"]: {
		address?: GraphQLTypes["order_by"] | undefined,
	city?: GraphQLTypes["order_by"] | undefined,
	created_at?: GraphQLTypes["order_by"] | undefined,
	created_by_id?: GraphQLTypes["order_by"] | undefined,
	cursor_id?: GraphQLTypes["order_by"] | undefined,
	date_of_establishment?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	landmark?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	pin?: GraphQLTypes["order_by"] | undefined,
	state?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updated_at?: GraphQLTypes["order_by"] | undefined,
	updated_by_id?: GraphQLTypes["order_by"] | undefined,
	website?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: Institute */
["Institute_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "Institute" */
["Institute_select_column"]: Institute_select_column;
	/** input type for updating data in table "Institute" */
["Institute_set_input"]: {
		address?: string | undefined,
	city?: string | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	created_by_id?: GraphQLTypes["uuid"] | undefined,
	cursor_id?: string | undefined,
	date_of_establishment?: GraphQLTypes["date"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	updated_by_id?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** Streaming cursor of the table "Institute" */
["Institute_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["Institute_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["Institute_stream_cursor_value_input"]: {
		address?: string | undefined,
	city?: string | undefined,
	created_at?: GraphQLTypes["timestamptz"] | undefined,
	created_by_id?: GraphQLTypes["uuid"] | undefined,
	cursor_id?: string | undefined,
	date_of_establishment?: GraphQLTypes["date"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	type?: string | undefined,
	updated_at?: GraphQLTypes["timestamptz"] | undefined,
	updated_by_id?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** update columns of table "Institute" */
["Institute_update_column"]: Institute_update_column;
	["Institute_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["Institute_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["Institute_bool_exp"]
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
	/** mutation root */
["mutation_root"]: {
	__typename: "mutation_root",
	/** delete data from the table: "EGovernance" */
	delete_EGovernance?: GraphQLTypes["EGovernance_mutation_response"] | undefined,
	/** delete single row from the table: "EGovernance" */
	delete_EGovernance_by_pk?: GraphQLTypes["EGovernance"] | undefined,
	/** delete data from the table: "Faculty" */
	delete_Faculty?: GraphQLTypes["Faculty_mutation_response"] | undefined,
	/** delete data from the table: "FacultyFunding" */
	delete_FacultyFunding?: GraphQLTypes["FacultyFunding_mutation_response"] | undefined,
	/** delete single row from the table: "FacultyFunding" */
	delete_FacultyFunding_by_pk?: GraphQLTypes["FacultyFunding"] | undefined,
	/** delete single row from the table: "Faculty" */
	delete_Faculty_by_pk?: GraphQLTypes["Faculty"] | undefined,
	/** delete data from the table: "FdpPdp" */
	delete_FdpPdp?: GraphQLTypes["FdpPdp_mutation_response"] | undefined,
	/** delete single row from the table: "FdpPdp" */
	delete_FdpPdp_by_pk?: GraphQLTypes["FdpPdp"] | undefined,
	/** delete data from the table: "Genesis" */
	delete_Genesis?: GraphQLTypes["Genesis_mutation_response"] | undefined,
	/** delete single row from the table: "Genesis" */
	delete_Genesis_by_pk?: GraphQLTypes["Genesis"] | undefined,
	/** delete data from the table: "Institute" */
	delete_Institute?: GraphQLTypes["Institute_mutation_response"] | undefined,
	/** delete data from the table: "InstituteFunding" */
	delete_InstituteFunding?: GraphQLTypes["InstituteFunding_mutation_response"] | undefined,
	/** delete single row from the table: "InstituteFunding" */
	delete_InstituteFunding_by_pk?: GraphQLTypes["InstituteFunding"] | undefined,
	/** delete single row from the table: "Institute" */
	delete_Institute_by_pk?: GraphQLTypes["Institute"] | undefined,
	/** insert data into the table: "EGovernance" */
	insert_EGovernance?: GraphQLTypes["EGovernance_mutation_response"] | undefined,
	/** insert a single row into the table: "EGovernance" */
	insert_EGovernance_one?: GraphQLTypes["EGovernance"] | undefined,
	/** insert data into the table: "Faculty" */
	insert_Faculty?: GraphQLTypes["Faculty_mutation_response"] | undefined,
	/** insert data into the table: "FacultyFunding" */
	insert_FacultyFunding?: GraphQLTypes["FacultyFunding_mutation_response"] | undefined,
	/** insert a single row into the table: "FacultyFunding" */
	insert_FacultyFunding_one?: GraphQLTypes["FacultyFunding"] | undefined,
	/** insert a single row into the table: "Faculty" */
	insert_Faculty_one?: GraphQLTypes["Faculty"] | undefined,
	/** insert data into the table: "FdpPdp" */
	insert_FdpPdp?: GraphQLTypes["FdpPdp_mutation_response"] | undefined,
	/** insert a single row into the table: "FdpPdp" */
	insert_FdpPdp_one?: GraphQLTypes["FdpPdp"] | undefined,
	/** insert data into the table: "Genesis" */
	insert_Genesis?: GraphQLTypes["Genesis_mutation_response"] | undefined,
	/** insert a single row into the table: "Genesis" */
	insert_Genesis_one?: GraphQLTypes["Genesis"] | undefined,
	/** insert data into the table: "Institute" */
	insert_Institute?: GraphQLTypes["Institute_mutation_response"] | undefined,
	/** insert data into the table: "InstituteFunding" */
	insert_InstituteFunding?: GraphQLTypes["InstituteFunding_mutation_response"] | undefined,
	/** insert a single row into the table: "InstituteFunding" */
	insert_InstituteFunding_one?: GraphQLTypes["InstituteFunding"] | undefined,
	/** insert a single row into the table: "Institute" */
	insert_Institute_one?: GraphQLTypes["Institute"] | undefined,
	/** update data of the table: "EGovernance" */
	update_EGovernance?: GraphQLTypes["EGovernance_mutation_response"] | undefined,
	/** update single row of the table: "EGovernance" */
	update_EGovernance_by_pk?: GraphQLTypes["EGovernance"] | undefined,
	/** update multiples rows of table: "EGovernance" */
	update_EGovernance_many?: Array<GraphQLTypes["EGovernance_mutation_response"] | undefined> | undefined,
	/** update data of the table: "Faculty" */
	update_Faculty?: GraphQLTypes["Faculty_mutation_response"] | undefined,
	/** update data of the table: "FacultyFunding" */
	update_FacultyFunding?: GraphQLTypes["FacultyFunding_mutation_response"] | undefined,
	/** update single row of the table: "FacultyFunding" */
	update_FacultyFunding_by_pk?: GraphQLTypes["FacultyFunding"] | undefined,
	/** update multiples rows of table: "FacultyFunding" */
	update_FacultyFunding_many?: Array<GraphQLTypes["FacultyFunding_mutation_response"] | undefined> | undefined,
	/** update single row of the table: "Faculty" */
	update_Faculty_by_pk?: GraphQLTypes["Faculty"] | undefined,
	/** update multiples rows of table: "Faculty" */
	update_Faculty_many?: Array<GraphQLTypes["Faculty_mutation_response"] | undefined> | undefined,
	/** update data of the table: "FdpPdp" */
	update_FdpPdp?: GraphQLTypes["FdpPdp_mutation_response"] | undefined,
	/** update single row of the table: "FdpPdp" */
	update_FdpPdp_by_pk?: GraphQLTypes["FdpPdp"] | undefined,
	/** update multiples rows of table: "FdpPdp" */
	update_FdpPdp_many?: Array<GraphQLTypes["FdpPdp_mutation_response"] | undefined> | undefined,
	/** update data of the table: "Genesis" */
	update_Genesis?: GraphQLTypes["Genesis_mutation_response"] | undefined,
	/** update single row of the table: "Genesis" */
	update_Genesis_by_pk?: GraphQLTypes["Genesis"] | undefined,
	/** update multiples rows of table: "Genesis" */
	update_Genesis_many?: Array<GraphQLTypes["Genesis_mutation_response"] | undefined> | undefined,
	/** update data of the table: "Institute" */
	update_Institute?: GraphQLTypes["Institute_mutation_response"] | undefined,
	/** update data of the table: "InstituteFunding" */
	update_InstituteFunding?: GraphQLTypes["InstituteFunding_mutation_response"] | undefined,
	/** update single row of the table: "InstituteFunding" */
	update_InstituteFunding_by_pk?: GraphQLTypes["InstituteFunding"] | undefined,
	/** update multiples rows of table: "InstituteFunding" */
	update_InstituteFunding_many?: Array<GraphQLTypes["InstituteFunding_mutation_response"] | undefined> | undefined,
	/** update single row of the table: "Institute" */
	update_Institute_by_pk?: GraphQLTypes["Institute"] | undefined,
	/** update multiples rows of table: "Institute" */
	update_Institute_many?: Array<GraphQLTypes["Institute_mutation_response"] | undefined> | undefined
};
	/** column ordering options */
["order_by"]: order_by;
	["query_root"]: {
	__typename: "query_root",
	/** fetch data from the table: "EGovernance" */
	EGovernance: Array<GraphQLTypes["EGovernance"]>,
	/** fetch aggregated fields from the table: "EGovernance" */
	EGovernance_aggregate: GraphQLTypes["EGovernance_aggregate"],
	/** fetch data from the table: "EGovernance" using primary key columns */
	EGovernance_by_pk?: GraphQLTypes["EGovernance"] | undefined,
	/** fetch data from the table: "Faculty" */
	Faculty: Array<GraphQLTypes["Faculty"]>,
	/** fetch data from the table: "FacultyFunding" */
	FacultyFunding: Array<GraphQLTypes["FacultyFunding"]>,
	/** fetch aggregated fields from the table: "FacultyFunding" */
	FacultyFunding_aggregate: GraphQLTypes["FacultyFunding_aggregate"],
	/** fetch data from the table: "FacultyFunding" using primary key columns */
	FacultyFunding_by_pk?: GraphQLTypes["FacultyFunding"] | undefined,
	/** fetch aggregated fields from the table: "Faculty" */
	Faculty_aggregate: GraphQLTypes["Faculty_aggregate"],
	/** fetch data from the table: "Faculty" using primary key columns */
	Faculty_by_pk?: GraphQLTypes["Faculty"] | undefined,
	/** fetch data from the table: "FdpPdp" */
	FdpPdp: Array<GraphQLTypes["FdpPdp"]>,
	/** fetch aggregated fields from the table: "FdpPdp" */
	FdpPdp_aggregate: GraphQLTypes["FdpPdp_aggregate"],
	/** fetch data from the table: "FdpPdp" using primary key columns */
	FdpPdp_by_pk?: GraphQLTypes["FdpPdp"] | undefined,
	/** fetch data from the table: "Genesis" */
	Genesis: Array<GraphQLTypes["Genesis"]>,
	/** fetch aggregated fields from the table: "Genesis" */
	Genesis_aggregate: GraphQLTypes["Genesis_aggregate"],
	/** fetch data from the table: "Genesis" using primary key columns */
	Genesis_by_pk?: GraphQLTypes["Genesis"] | undefined,
	/** fetch data from the table: "Institute" */
	Institute: Array<GraphQLTypes["Institute"]>,
	/** fetch data from the table: "InstituteFunding" */
	InstituteFunding: Array<GraphQLTypes["InstituteFunding"]>,
	/** fetch aggregated fields from the table: "InstituteFunding" */
	InstituteFunding_aggregate: GraphQLTypes["InstituteFunding_aggregate"],
	/** fetch data from the table: "InstituteFunding" using primary key columns */
	InstituteFunding_by_pk?: GraphQLTypes["InstituteFunding"] | undefined,
	/** fetch aggregated fields from the table: "Institute" */
	Institute_aggregate: GraphQLTypes["Institute_aggregate"],
	/** fetch data from the table: "Institute" using primary key columns */
	Institute_by_pk?: GraphQLTypes["Institute"] | undefined
};
	["subscription_root"]: {
	__typename: "subscription_root",
	/** fetch data from the table: "EGovernance" */
	EGovernance: Array<GraphQLTypes["EGovernance"]>,
	/** fetch aggregated fields from the table: "EGovernance" */
	EGovernance_aggregate: GraphQLTypes["EGovernance_aggregate"],
	/** fetch data from the table: "EGovernance" using primary key columns */
	EGovernance_by_pk?: GraphQLTypes["EGovernance"] | undefined,
	/** fetch data from the table in a streaming manner: "EGovernance" */
	EGovernance_stream: Array<GraphQLTypes["EGovernance"]>,
	/** fetch data from the table: "Faculty" */
	Faculty: Array<GraphQLTypes["Faculty"]>,
	/** fetch data from the table: "FacultyFunding" */
	FacultyFunding: Array<GraphQLTypes["FacultyFunding"]>,
	/** fetch aggregated fields from the table: "FacultyFunding" */
	FacultyFunding_aggregate: GraphQLTypes["FacultyFunding_aggregate"],
	/** fetch data from the table: "FacultyFunding" using primary key columns */
	FacultyFunding_by_pk?: GraphQLTypes["FacultyFunding"] | undefined,
	/** fetch data from the table in a streaming manner: "FacultyFunding" */
	FacultyFunding_stream: Array<GraphQLTypes["FacultyFunding"]>,
	/** fetch aggregated fields from the table: "Faculty" */
	Faculty_aggregate: GraphQLTypes["Faculty_aggregate"],
	/** fetch data from the table: "Faculty" using primary key columns */
	Faculty_by_pk?: GraphQLTypes["Faculty"] | undefined,
	/** fetch data from the table in a streaming manner: "Faculty" */
	Faculty_stream: Array<GraphQLTypes["Faculty"]>,
	/** fetch data from the table: "FdpPdp" */
	FdpPdp: Array<GraphQLTypes["FdpPdp"]>,
	/** fetch aggregated fields from the table: "FdpPdp" */
	FdpPdp_aggregate: GraphQLTypes["FdpPdp_aggregate"],
	/** fetch data from the table: "FdpPdp" using primary key columns */
	FdpPdp_by_pk?: GraphQLTypes["FdpPdp"] | undefined,
	/** fetch data from the table in a streaming manner: "FdpPdp" */
	FdpPdp_stream: Array<GraphQLTypes["FdpPdp"]>,
	/** fetch data from the table: "Genesis" */
	Genesis: Array<GraphQLTypes["Genesis"]>,
	/** fetch aggregated fields from the table: "Genesis" */
	Genesis_aggregate: GraphQLTypes["Genesis_aggregate"],
	/** fetch data from the table: "Genesis" using primary key columns */
	Genesis_by_pk?: GraphQLTypes["Genesis"] | undefined,
	/** fetch data from the table in a streaming manner: "Genesis" */
	Genesis_stream: Array<GraphQLTypes["Genesis"]>,
	/** fetch data from the table: "Institute" */
	Institute: Array<GraphQLTypes["Institute"]>,
	/** fetch data from the table: "InstituteFunding" */
	InstituteFunding: Array<GraphQLTypes["InstituteFunding"]>,
	/** fetch aggregated fields from the table: "InstituteFunding" */
	InstituteFunding_aggregate: GraphQLTypes["InstituteFunding_aggregate"],
	/** fetch data from the table: "InstituteFunding" using primary key columns */
	InstituteFunding_by_pk?: GraphQLTypes["InstituteFunding"] | undefined,
	/** fetch data from the table in a streaming manner: "InstituteFunding" */
	InstituteFunding_stream: Array<GraphQLTypes["InstituteFunding"]>,
	/** fetch aggregated fields from the table: "Institute" */
	Institute_aggregate: GraphQLTypes["Institute_aggregate"],
	/** fetch data from the table: "Institute" using primary key columns */
	Institute_by_pk?: GraphQLTypes["Institute"] | undefined,
	/** fetch data from the table in a streaming manner: "Institute" */
	Institute_stream: Array<GraphQLTypes["Institute"]>
};
	["timestamp"]: "scalar" & { name: "timestamp" };
	/** Boolean expression to compare columns of type "timestamp". All fields are combined with logical 'AND'. */
["timestamp_comparison_exp"]: {
		_eq?: GraphQLTypes["timestamp"] | undefined,
	_gt?: GraphQLTypes["timestamp"] | undefined,
	_gte?: GraphQLTypes["timestamp"] | undefined,
	_in?: Array<GraphQLTypes["timestamp"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: GraphQLTypes["timestamp"] | undefined,
	_lte?: GraphQLTypes["timestamp"] | undefined,
	_neq?: GraphQLTypes["timestamp"] | undefined,
	_nin?: Array<GraphQLTypes["timestamp"]> | undefined
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
/** unique or primary key constraints on table "EGovernance" */
export const enum EGovernance_constraint {
	EGovernance_pkey = "EGovernance_pkey"
}
/** select columns of table "EGovernance" */
export const enum EGovernance_select_column {
	address = "address",
	area = "area",
	createdById = "createdById",
	created_at = "created_at",
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
	updatedById = "updatedById",
	updated_at = "updated_at",
	website = "website"
}
/** update columns of table "EGovernance" */
export const enum EGovernance_update_column {
	address = "address",
	area = "area",
	createdById = "createdById",
	created_at = "created_at",
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
	updatedById = "updatedById",
	updated_at = "updated_at",
	website = "website"
}
/** unique or primary key constraints on table "FacultyFunding" */
export const enum FacultyFunding_constraint {
	FacultyFunding_pkey = "FacultyFunding_pkey"
}
/** select columns of table "FacultyFunding" */
export const enum FacultyFunding_select_column {
	amount = "amount",
	createdById = "createdById",
	created_at = "created_at",
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
	updatedById = "updatedById",
	updated_at = "updated_at"
}
/** update columns of table "FacultyFunding" */
export const enum FacultyFunding_update_column {
	amount = "amount",
	createdById = "createdById",
	created_at = "created_at",
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
	updatedById = "updatedById",
	updated_at = "updated_at"
}
/** unique or primary key constraints on table "Faculty" */
export const enum Faculty_constraint {
	Faculty_pkey = "Faculty_pkey"
}
/** select columns of table "Faculty" */
export const enum Faculty_select_column {
	address = "address",
	cast = "cast",
	createdById = "createdById",
	created_at = "created_at",
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
	updatedById = "updatedById",
	updated_at = "updated_at"
}
/** update columns of table "Faculty" */
export const enum Faculty_update_column {
	address = "address",
	cast = "cast",
	createdById = "createdById",
	created_at = "created_at",
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
	updatedById = "updatedById",
	updated_at = "updated_at"
}
/** unique or primary key constraints on table "FdpPdp" */
export const enum FdpPdp_constraint {
	FdpPdp_pkey = "FdpPdp_pkey"
}
/** select columns of table "FdpPdp" */
export const enum FdpPdp_select_column {
	createdById = "createdById",
	created_at = "created_at",
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
	updatedById = "updatedById",
	updated_at = "updated_at",
	venue = "venue"
}
/** update columns of table "FdpPdp" */
export const enum FdpPdp_update_column {
	createdById = "createdById",
	created_at = "created_at",
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
	updatedById = "updatedById",
	updated_at = "updated_at",
	venue = "venue"
}
/** unique or primary key constraints on table "Genesis" */
export const enum Genesis_constraint {
	Genesis_email_id_key = "Genesis_email_id_key",
	Genesis_phone_key = "Genesis_phone_key",
	Genesis_pkey = "Genesis_pkey"
}
/** select columns of table "Genesis" */
export const enum Genesis_select_column {
	created_at = "created_at",
	email_id = "email_id",
	id = "id",
	is_verified = "is_verified",
	name = "name",
	phone = "phone",
	role = "role",
	updated_at = "updated_at"
}
/** update columns of table "Genesis" */
export const enum Genesis_update_column {
	created_at = "created_at",
	email_id = "email_id",
	id = "id",
	is_verified = "is_verified",
	name = "name",
	phone = "phone",
	role = "role",
	updated_at = "updated_at"
}
/** unique or primary key constraints on table "InstituteFunding" */
export const enum InstituteFunding_constraint {
	InstituteFunding_pkey = "InstituteFunding_pkey"
}
/** select columns of table "InstituteFunding" */
export const enum InstituteFunding_select_column {
	amount = "amount",
	createdById = "createdById",
	created_at = "created_at",
	cursorId = "cursorId",
	id = "id",
	institute_id = "institute_id",
	name = "name",
	purpose = "purpose",
	status = "status",
	transaction_date = "transaction_date",
	transaction_type = "transaction_type",
	type = "type",
	updatedById = "updatedById",
	updated_at = "updated_at"
}
/** update columns of table "InstituteFunding" */
export const enum InstituteFunding_update_column {
	amount = "amount",
	createdById = "createdById",
	created_at = "created_at",
	cursorId = "cursorId",
	id = "id",
	institute_id = "institute_id",
	name = "name",
	purpose = "purpose",
	status = "status",
	transaction_date = "transaction_date",
	transaction_type = "transaction_type",
	type = "type",
	updatedById = "updatedById",
	updated_at = "updated_at"
}
/** unique or primary key constraints on table "Institute" */
export const enum Institute_constraint {
	Institute_pkey = "Institute_pkey"
}
/** select columns of table "Institute" */
export const enum Institute_select_column {
	address = "address",
	city = "city",
	created_at = "created_at",
	created_by_id = "created_by_id",
	cursor_id = "cursor_id",
	date_of_establishment = "date_of_establishment",
	id = "id",
	landmark = "landmark",
	name = "name",
	pin = "pin",
	state = "state",
	type = "type",
	updated_at = "updated_at",
	updated_by_id = "updated_by_id",
	website = "website"
}
/** update columns of table "Institute" */
export const enum Institute_update_column {
	address = "address",
	city = "city",
	created_at = "created_at",
	created_by_id = "created_by_id",
	cursor_id = "cursor_id",
	date_of_establishment = "date_of_establishment",
	id = "id",
	landmark = "landmark",
	name = "name",
	pin = "pin",
	state = "state",
	type = "type",
	updated_at = "updated_at",
	updated_by_id = "updated_by_id",
	website = "website"
}
/** ordering argument of a cursor */
export const enum cursor_ordering {
	ASC = "ASC",
	DESC = "DESC"
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
	["Boolean_comparison_exp"]: ValueTypes["Boolean_comparison_exp"];
	["EGovernance_bool_exp"]: ValueTypes["EGovernance_bool_exp"];
	["EGovernance_constraint"]: ValueTypes["EGovernance_constraint"];
	["EGovernance_insert_input"]: ValueTypes["EGovernance_insert_input"];
	["EGovernance_on_conflict"]: ValueTypes["EGovernance_on_conflict"];
	["EGovernance_order_by"]: ValueTypes["EGovernance_order_by"];
	["EGovernance_pk_columns_input"]: ValueTypes["EGovernance_pk_columns_input"];
	["EGovernance_select_column"]: ValueTypes["EGovernance_select_column"];
	["EGovernance_set_input"]: ValueTypes["EGovernance_set_input"];
	["EGovernance_stream_cursor_input"]: ValueTypes["EGovernance_stream_cursor_input"];
	["EGovernance_stream_cursor_value_input"]: ValueTypes["EGovernance_stream_cursor_value_input"];
	["EGovernance_update_column"]: ValueTypes["EGovernance_update_column"];
	["EGovernance_updates"]: ValueTypes["EGovernance_updates"];
	["FacultyFunding_bool_exp"]: ValueTypes["FacultyFunding_bool_exp"];
	["FacultyFunding_constraint"]: ValueTypes["FacultyFunding_constraint"];
	["FacultyFunding_insert_input"]: ValueTypes["FacultyFunding_insert_input"];
	["FacultyFunding_on_conflict"]: ValueTypes["FacultyFunding_on_conflict"];
	["FacultyFunding_order_by"]: ValueTypes["FacultyFunding_order_by"];
	["FacultyFunding_pk_columns_input"]: ValueTypes["FacultyFunding_pk_columns_input"];
	["FacultyFunding_select_column"]: ValueTypes["FacultyFunding_select_column"];
	["FacultyFunding_set_input"]: ValueTypes["FacultyFunding_set_input"];
	["FacultyFunding_stream_cursor_input"]: ValueTypes["FacultyFunding_stream_cursor_input"];
	["FacultyFunding_stream_cursor_value_input"]: ValueTypes["FacultyFunding_stream_cursor_value_input"];
	["FacultyFunding_update_column"]: ValueTypes["FacultyFunding_update_column"];
	["FacultyFunding_updates"]: ValueTypes["FacultyFunding_updates"];
	["Faculty_bool_exp"]: ValueTypes["Faculty_bool_exp"];
	["Faculty_constraint"]: ValueTypes["Faculty_constraint"];
	["Faculty_insert_input"]: ValueTypes["Faculty_insert_input"];
	["Faculty_on_conflict"]: ValueTypes["Faculty_on_conflict"];
	["Faculty_order_by"]: ValueTypes["Faculty_order_by"];
	["Faculty_pk_columns_input"]: ValueTypes["Faculty_pk_columns_input"];
	["Faculty_select_column"]: ValueTypes["Faculty_select_column"];
	["Faculty_set_input"]: ValueTypes["Faculty_set_input"];
	["Faculty_stream_cursor_input"]: ValueTypes["Faculty_stream_cursor_input"];
	["Faculty_stream_cursor_value_input"]: ValueTypes["Faculty_stream_cursor_value_input"];
	["Faculty_update_column"]: ValueTypes["Faculty_update_column"];
	["Faculty_updates"]: ValueTypes["Faculty_updates"];
	["FdpPdp_bool_exp"]: ValueTypes["FdpPdp_bool_exp"];
	["FdpPdp_constraint"]: ValueTypes["FdpPdp_constraint"];
	["FdpPdp_insert_input"]: ValueTypes["FdpPdp_insert_input"];
	["FdpPdp_on_conflict"]: ValueTypes["FdpPdp_on_conflict"];
	["FdpPdp_order_by"]: ValueTypes["FdpPdp_order_by"];
	["FdpPdp_pk_columns_input"]: ValueTypes["FdpPdp_pk_columns_input"];
	["FdpPdp_select_column"]: ValueTypes["FdpPdp_select_column"];
	["FdpPdp_set_input"]: ValueTypes["FdpPdp_set_input"];
	["FdpPdp_stream_cursor_input"]: ValueTypes["FdpPdp_stream_cursor_input"];
	["FdpPdp_stream_cursor_value_input"]: ValueTypes["FdpPdp_stream_cursor_value_input"];
	["FdpPdp_update_column"]: ValueTypes["FdpPdp_update_column"];
	["FdpPdp_updates"]: ValueTypes["FdpPdp_updates"];
	["Genesis_bool_exp"]: ValueTypes["Genesis_bool_exp"];
	["Genesis_constraint"]: ValueTypes["Genesis_constraint"];
	["Genesis_insert_input"]: ValueTypes["Genesis_insert_input"];
	["Genesis_on_conflict"]: ValueTypes["Genesis_on_conflict"];
	["Genesis_order_by"]: ValueTypes["Genesis_order_by"];
	["Genesis_pk_columns_input"]: ValueTypes["Genesis_pk_columns_input"];
	["Genesis_select_column"]: ValueTypes["Genesis_select_column"];
	["Genesis_set_input"]: ValueTypes["Genesis_set_input"];
	["Genesis_stream_cursor_input"]: ValueTypes["Genesis_stream_cursor_input"];
	["Genesis_stream_cursor_value_input"]: ValueTypes["Genesis_stream_cursor_value_input"];
	["Genesis_update_column"]: ValueTypes["Genesis_update_column"];
	["Genesis_updates"]: ValueTypes["Genesis_updates"];
	["InstituteFunding_bool_exp"]: ValueTypes["InstituteFunding_bool_exp"];
	["InstituteFunding_constraint"]: ValueTypes["InstituteFunding_constraint"];
	["InstituteFunding_insert_input"]: ValueTypes["InstituteFunding_insert_input"];
	["InstituteFunding_on_conflict"]: ValueTypes["InstituteFunding_on_conflict"];
	["InstituteFunding_order_by"]: ValueTypes["InstituteFunding_order_by"];
	["InstituteFunding_pk_columns_input"]: ValueTypes["InstituteFunding_pk_columns_input"];
	["InstituteFunding_select_column"]: ValueTypes["InstituteFunding_select_column"];
	["InstituteFunding_set_input"]: ValueTypes["InstituteFunding_set_input"];
	["InstituteFunding_stream_cursor_input"]: ValueTypes["InstituteFunding_stream_cursor_input"];
	["InstituteFunding_stream_cursor_value_input"]: ValueTypes["InstituteFunding_stream_cursor_value_input"];
	["InstituteFunding_update_column"]: ValueTypes["InstituteFunding_update_column"];
	["InstituteFunding_updates"]: ValueTypes["InstituteFunding_updates"];
	["Institute_bool_exp"]: ValueTypes["Institute_bool_exp"];
	["Institute_constraint"]: ValueTypes["Institute_constraint"];
	["Institute_insert_input"]: ValueTypes["Institute_insert_input"];
	["Institute_on_conflict"]: ValueTypes["Institute_on_conflict"];
	["Institute_order_by"]: ValueTypes["Institute_order_by"];
	["Institute_pk_columns_input"]: ValueTypes["Institute_pk_columns_input"];
	["Institute_select_column"]: ValueTypes["Institute_select_column"];
	["Institute_set_input"]: ValueTypes["Institute_set_input"];
	["Institute_stream_cursor_input"]: ValueTypes["Institute_stream_cursor_input"];
	["Institute_stream_cursor_value_input"]: ValueTypes["Institute_stream_cursor_value_input"];
	["Institute_update_column"]: ValueTypes["Institute_update_column"];
	["Institute_updates"]: ValueTypes["Institute_updates"];
	["String_comparison_exp"]: ValueTypes["String_comparison_exp"];
	["cursor_ordering"]: ValueTypes["cursor_ordering"];
	["date"]: ValueTypes["date"];
	["date_comparison_exp"]: ValueTypes["date_comparison_exp"];
	["order_by"]: ValueTypes["order_by"];
	["timestamp"]: ValueTypes["timestamp"];
	["timestamp_comparison_exp"]: ValueTypes["timestamp_comparison_exp"];
	["timestamptz"]: ValueTypes["timestamptz"];
	["timestamptz_comparison_exp"]: ValueTypes["timestamptz_comparison_exp"];
	["uuid"]: ValueTypes["uuid"];
	["uuid_comparison_exp"]: ValueTypes["uuid_comparison_exp"];
}