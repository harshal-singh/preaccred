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
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	serviceEndDate?:boolean | `@${string}`,
	serviceStartDate?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	totalAmount?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	avg?:ValueTypes["EGovernance_avg_fields"],
count?: [{	columns?: Array<ValueTypes["EGovernance_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["EGovernance_max_fields"],
	min?:ValueTypes["EGovernance_min_fields"],
	stddev?:ValueTypes["EGovernance_stddev_fields"],
	stddev_pop?:ValueTypes["EGovernance_stddev_pop_fields"],
	stddev_samp?:ValueTypes["EGovernance_stddev_samp_fields"],
	sum?:ValueTypes["EGovernance_sum_fields"],
	var_pop?:ValueTypes["EGovernance_var_pop_fields"],
	var_samp?:ValueTypes["EGovernance_var_samp_fields"],
	variance?:ValueTypes["EGovernance_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["EGovernance_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "EGovernance". All fields are combined with a logical 'AND'. */
["EGovernance_bool_exp"]: {
	_and?: Array<ValueTypes["EGovernance_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["EGovernance_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["EGovernance_bool_exp"]> | undefined | null | Variable<any, string>,
	address?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	area?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	phoneNo?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	serviceEndDate?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	serviceStartDate?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	totalAmount?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	website?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "EGovernance" */
["EGovernance_constraint"]:EGovernance_constraint;
	/** input type for incrementing numeric columns in table "EGovernance" */
["EGovernance_inc_input"]: {
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "EGovernance" */
["EGovernance_insert_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	area?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phoneNo?: string | undefined | null | Variable<any, string>,
	serviceEndDate?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	serviceStartDate?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	totalAmount?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["EGovernance_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	serviceEndDate?:boolean | `@${string}`,
	serviceStartDate?:boolean | `@${string}`,
	totalAmount?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["EGovernance_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	serviceEndDate?:boolean | `@${string}`,
	serviceStartDate?:boolean | `@${string}`,
	totalAmount?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phoneNo?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	serviceEndDate?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	serviceStartDate?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	totalAmount?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
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
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phoneNo?: string | undefined | null | Variable<any, string>,
	serviceEndDate?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	serviceStartDate?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	totalAmount?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["EGovernance_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["EGovernance_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["EGovernance_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
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
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phoneNo?: string | undefined | null | Variable<any, string>,
	serviceEndDate?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	serviceStartDate?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	totalAmount?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["EGovernance_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "EGovernance" */
["EGovernance_update_column"]:EGovernance_update_column;
	["EGovernance_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["EGovernance_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["EGovernance_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["EGovernance_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["EGovernance_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["EGovernance_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["EGovernance_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "Faculty" */
["Faculty"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateOfJoining?:boolean | `@${string}`,
	designation?:boolean | `@${string}`,
	dob?:boolean | `@${string}`,
	emailId?:boolean | `@${string}`,
	experience?:boolean | `@${string}`,
	gender?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	isVerified?:boolean | `@${string}`,
	jobType?:boolean | `@${string}`,
	minority?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	panCardNo?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	qualification?:boolean | `@${string}`,
	section?:boolean | `@${string}`,
	staffType?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	statusOfApproval?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "FacultyFunding" */
["FacultyFunding"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	facultyId?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transactionDate?:boolean | `@${string}`,
	transactionType?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	avg?:ValueTypes["FacultyFunding_avg_fields"],
count?: [{	columns?: Array<ValueTypes["FacultyFunding_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["FacultyFunding_max_fields"],
	min?:ValueTypes["FacultyFunding_min_fields"],
	stddev?:ValueTypes["FacultyFunding_stddev_fields"],
	stddev_pop?:ValueTypes["FacultyFunding_stddev_pop_fields"],
	stddev_samp?:ValueTypes["FacultyFunding_stddev_samp_fields"],
	sum?:ValueTypes["FacultyFunding_sum_fields"],
	var_pop?:ValueTypes["FacultyFunding_var_pop_fields"],
	var_samp?:ValueTypes["FacultyFunding_var_samp_fields"],
	variance?:ValueTypes["FacultyFunding_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["FacultyFunding_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "FacultyFunding". All fields are combined with a logical 'AND'. */
["FacultyFunding_bool_exp"]: {
	_and?: Array<ValueTypes["FacultyFunding_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["FacultyFunding_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["FacultyFunding_bool_exp"]> | undefined | null | Variable<any, string>,
	amount?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	facultyId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	transactionDate?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	transactionType?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "FacultyFunding" */
["FacultyFunding_constraint"]:FacultyFunding_constraint;
	/** input type for incrementing numeric columns in table "FacultyFunding" */
["FacultyFunding_inc_input"]: {
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "FacultyFunding" */
["FacultyFunding_insert_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	facultyId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	transactionDate?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transactionType?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["FacultyFunding_max_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	facultyId?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	transactionDate?:boolean | `@${string}`,
	transactionType?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["FacultyFunding_min_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	facultyId?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	transactionDate?:boolean | `@${string}`,
	transactionType?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	facultyId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transactionDate?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transactionType?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
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
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	facultyId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	transactionDate?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transactionType?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["FacultyFunding_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["FacultyFunding_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["FacultyFunding_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
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
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	facultyId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	transactionDate?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transactionType?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["FacultyFunding_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "FacultyFunding" */
["FacultyFunding_update_column"]:FacultyFunding_update_column;
	["FacultyFunding_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["FacultyFunding_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["FacultyFunding_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["FacultyFunding_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["FacultyFunding_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["FacultyFunding_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["FacultyFunding_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "Faculty" */
["Faculty_aggregate"]: AliasType<{
	aggregate?:ValueTypes["Faculty_aggregate_fields"],
	nodes?:ValueTypes["Faculty"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "Faculty" */
["Faculty_aggregate_fields"]: AliasType<{
	avg?:ValueTypes["Faculty_avg_fields"],
count?: [{	columns?: Array<ValueTypes["Faculty_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["Faculty_max_fields"],
	min?:ValueTypes["Faculty_min_fields"],
	stddev?:ValueTypes["Faculty_stddev_fields"],
	stddev_pop?:ValueTypes["Faculty_stddev_pop_fields"],
	stddev_samp?:ValueTypes["Faculty_stddev_samp_fields"],
	sum?:ValueTypes["Faculty_sum_fields"],
	var_pop?:ValueTypes["Faculty_var_pop_fields"],
	var_samp?:ValueTypes["Faculty_var_samp_fields"],
	variance?:ValueTypes["Faculty_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["Faculty_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "Faculty". All fields are combined with a logical 'AND'. */
["Faculty_bool_exp"]: {
	_and?: Array<ValueTypes["Faculty_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["Faculty_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["Faculty_bool_exp"]> | undefined | null | Variable<any, string>,
	address?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	cast?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	dateOfJoining?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	designation?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	dob?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	emailId?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	experience?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	gender?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	isVerified?: ValueTypes["Boolean_comparison_exp"] | undefined | null | Variable<any, string>,
	jobType?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	minority?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	panCardNo?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	phoneNo?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	qualification?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	section?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	staffType?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	statusOfApproval?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "Faculty" */
["Faculty_constraint"]:Faculty_constraint;
	/** input type for incrementing numeric columns in table "Faculty" */
["Faculty_inc_input"]: {
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "Faculty" */
["Faculty_insert_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	cast?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	dateOfJoining?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	designation?: string | undefined | null | Variable<any, string>,
	dob?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	emailId?: string | undefined | null | Variable<any, string>,
	experience?: string | undefined | null | Variable<any, string>,
	gender?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isVerified?: boolean | undefined | null | Variable<any, string>,
	jobType?: string | undefined | null | Variable<any, string>,
	minority?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	panCardNo?: string | undefined | null | Variable<any, string>,
	phoneNo?: string | undefined | null | Variable<any, string>,
	qualification?: string | undefined | null | Variable<any, string>,
	section?: string | undefined | null | Variable<any, string>,
	staffType?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	statusOfApproval?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["Faculty_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateOfJoining?:boolean | `@${string}`,
	designation?:boolean | `@${string}`,
	dob?:boolean | `@${string}`,
	emailId?:boolean | `@${string}`,
	experience?:boolean | `@${string}`,
	gender?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	jobType?:boolean | `@${string}`,
	minority?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	panCardNo?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	qualification?:boolean | `@${string}`,
	section?:boolean | `@${string}`,
	staffType?:boolean | `@${string}`,
	statusOfApproval?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["Faculty_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateOfJoining?:boolean | `@${string}`,
	designation?:boolean | `@${string}`,
	dob?:boolean | `@${string}`,
	emailId?:boolean | `@${string}`,
	experience?:boolean | `@${string}`,
	gender?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	jobType?:boolean | `@${string}`,
	minority?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	panCardNo?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	qualification?:boolean | `@${string}`,
	section?:boolean | `@${string}`,
	staffType?:boolean | `@${string}`,
	statusOfApproval?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	dateOfJoining?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	designation?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	dob?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	emailId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	experience?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	gender?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	isVerified?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	jobType?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	minority?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	panCardNo?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phoneNo?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	qualification?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	section?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	staffType?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	statusOfApproval?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
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
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	dateOfJoining?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	designation?: string | undefined | null | Variable<any, string>,
	dob?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	emailId?: string | undefined | null | Variable<any, string>,
	experience?: string | undefined | null | Variable<any, string>,
	gender?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isVerified?: boolean | undefined | null | Variable<any, string>,
	jobType?: string | undefined | null | Variable<any, string>,
	minority?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	panCardNo?: string | undefined | null | Variable<any, string>,
	phoneNo?: string | undefined | null | Variable<any, string>,
	qualification?: string | undefined | null | Variable<any, string>,
	section?: string | undefined | null | Variable<any, string>,
	staffType?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	statusOfApproval?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["Faculty_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["Faculty_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["Faculty_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
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
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	dateOfJoining?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	designation?: string | undefined | null | Variable<any, string>,
	dob?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	emailId?: string | undefined | null | Variable<any, string>,
	experience?: string | undefined | null | Variable<any, string>,
	gender?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isVerified?: boolean | undefined | null | Variable<any, string>,
	jobType?: string | undefined | null | Variable<any, string>,
	minority?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	panCardNo?: string | undefined | null | Variable<any, string>,
	phoneNo?: string | undefined | null | Variable<any, string>,
	qualification?: string | undefined | null | Variable<any, string>,
	section?: string | undefined | null | Variable<any, string>,
	staffType?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	statusOfApproval?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["Faculty_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "Faculty" */
["Faculty_update_column"]:Faculty_update_column;
	["Faculty_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["Faculty_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Faculty_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["Faculty_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["Faculty_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["Faculty_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["Faculty_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "FdpPdp" */
["FdpPdp"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateFrom?:boolean | `@${string}`,
	dateTo?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	facultyId?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	avg?:ValueTypes["FdpPdp_avg_fields"],
count?: [{	columns?: Array<ValueTypes["FdpPdp_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["FdpPdp_max_fields"],
	min?:ValueTypes["FdpPdp_min_fields"],
	stddev?:ValueTypes["FdpPdp_stddev_fields"],
	stddev_pop?:ValueTypes["FdpPdp_stddev_pop_fields"],
	stddev_samp?:ValueTypes["FdpPdp_stddev_samp_fields"],
	sum?:ValueTypes["FdpPdp_sum_fields"],
	var_pop?:ValueTypes["FdpPdp_var_pop_fields"],
	var_samp?:ValueTypes["FdpPdp_var_samp_fields"],
	variance?:ValueTypes["FdpPdp_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["FdpPdp_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "FdpPdp". All fields are combined with a logical 'AND'. */
["FdpPdp_bool_exp"]: {
	_and?: Array<ValueTypes["FdpPdp_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["FdpPdp_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["FdpPdp_bool_exp"]> | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	dateFrom?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	dateTo?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	facultyId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	venue?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "FdpPdp" */
["FdpPdp_constraint"]:FdpPdp_constraint;
	/** input type for incrementing numeric columns in table "FdpPdp" */
["FdpPdp_inc_input"]: {
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "FdpPdp" */
["FdpPdp_insert_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	dateFrom?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	dateTo?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	facultyId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	venue?: string | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["FdpPdp_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateFrom?:boolean | `@${string}`,
	dateTo?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	facultyId?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["FdpPdp_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateFrom?:boolean | `@${string}`,
	dateTo?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	facultyId?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	dateFrom?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	dateTo?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	facultyId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	nature?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
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
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	dateFrom?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	dateTo?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	facultyId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	venue?: string | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["FdpPdp_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["FdpPdp_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["FdpPdp_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Streaming cursor of the table "FdpPdp" */
["FdpPdp_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["FdpPdp_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["FdpPdp_stream_cursor_value_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	dateFrom?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	dateTo?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	facultyId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	nature?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	venue?: string | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["FdpPdp_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "FdpPdp" */
["FdpPdp_update_column"]:FdpPdp_update_column;
	["FdpPdp_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["FdpPdp_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["FdpPdp_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["FdpPdp_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["FdpPdp_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["FdpPdp_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["FdpPdp_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "Genesis" */
["Genesis"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	emailId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isVerified?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
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
	createdAt?: ValueTypes["timestamp_comparison_exp"] | undefined | null | Variable<any, string>,
	emailId?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	isVerified?: ValueTypes["Boolean_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	phoneNo?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamp_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "Genesis" */
["Genesis_constraint"]:Genesis_constraint;
	/** input type for inserting data into table "Genesis" */
["Genesis_insert_input"]: {
	createdAt?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>,
	emailId?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isVerified?: boolean | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phoneNo?: string | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["Genesis_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	emailId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["Genesis_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	emailId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
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
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	emailId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	isVerified?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phoneNo?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: Genesis */
["Genesis_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "Genesis" */
["Genesis_select_column"]:Genesis_select_column;
	/** input type for updating data in table "Genesis" */
["Genesis_set_input"]: {
	createdAt?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>,
	emailId?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isVerified?: boolean | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phoneNo?: string | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>
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
	createdAt?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>,
	emailId?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isVerified?: boolean | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	phoneNo?: string | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamp"] | undefined | null | Variable<any, string>
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
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateOfEstablishment?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isVerified?:boolean | `@${string}`,
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
	/** columns and relationships of "InstituteFunding" */
["InstituteFunding"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transactionDate?:boolean | `@${string}`,
	transactionType?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	avg?:ValueTypes["InstituteFunding_avg_fields"],
count?: [{	columns?: Array<ValueTypes["InstituteFunding_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["InstituteFunding_max_fields"],
	min?:ValueTypes["InstituteFunding_min_fields"],
	stddev?:ValueTypes["InstituteFunding_stddev_fields"],
	stddev_pop?:ValueTypes["InstituteFunding_stddev_pop_fields"],
	stddev_samp?:ValueTypes["InstituteFunding_stddev_samp_fields"],
	sum?:ValueTypes["InstituteFunding_sum_fields"],
	var_pop?:ValueTypes["InstituteFunding_var_pop_fields"],
	var_samp?:ValueTypes["InstituteFunding_var_samp_fields"],
	variance?:ValueTypes["InstituteFunding_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["InstituteFunding_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "InstituteFunding". All fields are combined with a logical 'AND'. */
["InstituteFunding_bool_exp"]: {
	_and?: Array<ValueTypes["InstituteFunding_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["InstituteFunding_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["InstituteFunding_bool_exp"]> | undefined | null | Variable<any, string>,
	amount?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	purpose?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	transactionDate?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	transactionType?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "InstituteFunding" */
["InstituteFunding_constraint"]:InstituteFunding_constraint;
	/** input type for incrementing numeric columns in table "InstituteFunding" */
["InstituteFunding_inc_input"]: {
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "InstituteFunding" */
["InstituteFunding_insert_input"]: {
	amount?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	purpose?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	transactionDate?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transactionType?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["InstituteFunding_max_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	transactionDate?:boolean | `@${string}`,
	transactionType?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["InstituteFunding_min_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	transactionDate?:boolean | `@${string}`,
	transactionType?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	purpose?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transactionDate?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transactionType?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
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
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	purpose?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	transactionDate?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transactionType?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["InstituteFunding_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["InstituteFunding_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["InstituteFunding_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
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
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	instituteId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	purpose?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	transactionDate?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	transactionType?: string | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["InstituteFunding_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "InstituteFunding" */
["InstituteFunding_update_column"]:InstituteFunding_update_column;
	["InstituteFunding_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["InstituteFunding_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["InstituteFunding_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["InstituteFunding_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["InstituteFunding_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["InstituteFunding_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["InstituteFunding_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "Institute" */
["Institute_aggregate"]: AliasType<{
	aggregate?:ValueTypes["Institute_aggregate_fields"],
	nodes?:ValueTypes["Institute"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "Institute" */
["Institute_aggregate_fields"]: AliasType<{
	avg?:ValueTypes["Institute_avg_fields"],
count?: [{	columns?: Array<ValueTypes["Institute_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["Institute_max_fields"],
	min?:ValueTypes["Institute_min_fields"],
	stddev?:ValueTypes["Institute_stddev_fields"],
	stddev_pop?:ValueTypes["Institute_stddev_pop_fields"],
	stddev_samp?:ValueTypes["Institute_stddev_samp_fields"],
	sum?:ValueTypes["Institute_sum_fields"],
	var_pop?:ValueTypes["Institute_var_pop_fields"],
	var_samp?:ValueTypes["Institute_var_samp_fields"],
	variance?:ValueTypes["Institute_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["Institute_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "Institute". All fields are combined with a logical 'AND'. */
["Institute_bool_exp"]: {
	_and?: Array<ValueTypes["Institute_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["Institute_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["Institute_bool_exp"]> | undefined | null | Variable<any, string>,
	address?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	city?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	dateOfEstablishment?: ValueTypes["date_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	isVerified?: ValueTypes["Boolean_comparison_exp"] | undefined | null | Variable<any, string>,
	landmark?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	pin?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	state?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	website?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "Institute" */
["Institute_constraint"]:Institute_constraint;
	/** input type for incrementing numeric columns in table "Institute" */
["Institute_inc_input"]: {
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "Institute" */
["Institute_insert_input"]: {
	address?: string | undefined | null | Variable<any, string>,
	city?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	dateOfEstablishment?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isVerified?: boolean | undefined | null | Variable<any, string>,
	landmark?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	pin?: string | undefined | null | Variable<any, string>,
	state?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["Institute_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateOfEstablishment?:boolean | `@${string}`,
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
["Institute_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateOfEstablishment?:boolean | `@${string}`,
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
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	dateOfEstablishment?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	isVerified?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
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
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	dateOfEstablishment?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isVerified?: boolean | undefined | null | Variable<any, string>,
	landmark?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	pin?: string | undefined | null | Variable<any, string>,
	state?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["Institute_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["Institute_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["Institute_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
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
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	createdById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	cursorId?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	dateOfEstablishment?: ValueTypes["date"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isVerified?: boolean | undefined | null | Variable<any, string>,
	landmark?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	pin?: string | undefined | null | Variable<any, string>,
	state?: string | undefined | null | Variable<any, string>,
	status?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	type?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedById?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	website?: string | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["Institute_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "Institute" */
["Institute_update_column"]:Institute_update_column;
	["Institute_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["Institute_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Institute_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["Institute_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["Institute_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["Institute_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["Institute_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "Status" */
["Status"]: AliasType<{
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "Status" */
["Status_aggregate"]: AliasType<{
	aggregate?:ValueTypes["Status_aggregate_fields"],
	nodes?:ValueTypes["Status"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "Status" */
["Status_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["Status_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["Status_max_fields"],
	min?:ValueTypes["Status_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "Status". All fields are combined with a logical 'AND'. */
["Status_bool_exp"]: {
	_and?: Array<ValueTypes["Status_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["Status_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["Status_bool_exp"]> | undefined | null | Variable<any, string>,
	value?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "Status" */
["Status_constraint"]:Status_constraint;
	["Status_enum"]:Status_enum;
	/** Boolean expression to compare columns of type "Status_enum". All fields are combined with logical 'AND'. */
["Status_enum_comparison_exp"]: {
	_eq?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["Status_enum"]> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["Status_enum"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["Status_enum"]> | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "Status" */
["Status_insert_input"]: {
	value?: string | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["Status_max_fields"]: AliasType<{
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["Status_min_fields"]: AliasType<{
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "Status" */
["Status_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["Status"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "Status" */
["Status_on_conflict"]: {
	constraint: ValueTypes["Status_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["Status_update_column"]> | Variable<any, string>,
	where?: ValueTypes["Status_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "Status". */
["Status_order_by"]: {
	value?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: Status */
["Status_pk_columns_input"]: {
	value: string | Variable<any, string>
};
	/** select columns of table "Status" */
["Status_select_column"]:Status_select_column;
	/** input type for updating data in table "Status" */
["Status_set_input"]: {
	value?: string | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "Status" */
["Status_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["Status_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["Status_stream_cursor_value_input"]: {
	value?: string | undefined | null | Variable<any, string>
};
	/** update columns of table "Status" */
["Status_update_column"]:Status_update_column;
	["Status_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Status_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["Status_bool_exp"] | Variable<any, string>
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
delete_Status?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["Status_bool_exp"] | Variable<any, string>},ValueTypes["Status_mutation_response"]],
delete_Status_by_pk?: [{	value: string | Variable<any, string>},ValueTypes["Status"]],
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
insert_Status?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["Status_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["Status_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["Status_mutation_response"]],
insert_Status_one?: [{	/** the row to be inserted */
	object: ValueTypes["Status_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["Status_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["Status"]],
update_EGovernance?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["EGovernance_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["EGovernance_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["EGovernance_bool_exp"] | Variable<any, string>},ValueTypes["EGovernance_mutation_response"]],
update_EGovernance_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["EGovernance_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["EGovernance_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["EGovernance_pk_columns_input"] | Variable<any, string>},ValueTypes["EGovernance"]],
update_EGovernance_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["EGovernance_updates"]> | Variable<any, string>},ValueTypes["EGovernance_mutation_response"]],
update_Faculty?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["Faculty_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Faculty_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["Faculty_bool_exp"] | Variable<any, string>},ValueTypes["Faculty_mutation_response"]],
update_FacultyFunding?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["FacultyFunding_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["FacultyFunding_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["FacultyFunding_bool_exp"] | Variable<any, string>},ValueTypes["FacultyFunding_mutation_response"]],
update_FacultyFunding_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["FacultyFunding_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["FacultyFunding_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["FacultyFunding_pk_columns_input"] | Variable<any, string>},ValueTypes["FacultyFunding"]],
update_FacultyFunding_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["FacultyFunding_updates"]> | Variable<any, string>},ValueTypes["FacultyFunding_mutation_response"]],
update_Faculty_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["Faculty_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Faculty_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["Faculty_pk_columns_input"] | Variable<any, string>},ValueTypes["Faculty"]],
update_Faculty_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["Faculty_updates"]> | Variable<any, string>},ValueTypes["Faculty_mutation_response"]],
update_FdpPdp?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["FdpPdp_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["FdpPdp_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["FdpPdp_bool_exp"] | Variable<any, string>},ValueTypes["FdpPdp_mutation_response"]],
update_FdpPdp_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["FdpPdp_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
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
update_Institute?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["Institute_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Institute_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["Institute_bool_exp"] | Variable<any, string>},ValueTypes["Institute_mutation_response"]],
update_InstituteFunding?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["InstituteFunding_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["InstituteFunding_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["InstituteFunding_bool_exp"] | Variable<any, string>},ValueTypes["InstituteFunding_mutation_response"]],
update_InstituteFunding_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["InstituteFunding_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["InstituteFunding_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["InstituteFunding_pk_columns_input"] | Variable<any, string>},ValueTypes["InstituteFunding"]],
update_InstituteFunding_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["InstituteFunding_updates"]> | Variable<any, string>},ValueTypes["InstituteFunding_mutation_response"]],
update_Institute_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["Institute_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Institute_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["Institute_pk_columns_input"] | Variable<any, string>},ValueTypes["Institute"]],
update_Institute_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["Institute_updates"]> | Variable<any, string>},ValueTypes["Institute_mutation_response"]],
update_Status?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Status_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["Status_bool_exp"] | Variable<any, string>},ValueTypes["Status_mutation_response"]],
update_Status_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["Status_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["Status_pk_columns_input"] | Variable<any, string>},ValueTypes["Status"]],
update_Status_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["Status_updates"]> | Variable<any, string>},ValueTypes["Status_mutation_response"]],
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
Status?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Status_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Status_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Status_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Status"]],
Status_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Status_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Status_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Status_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Status_aggregate"]],
Status_by_pk?: [{	value: string | Variable<any, string>},ValueTypes["Status"]],
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
Status?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Status_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Status_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Status_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Status"]],
Status_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["Status_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["Status_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Status_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Status_aggregate"]],
Status_by_pk?: [{	value: string | Variable<any, string>},ValueTypes["Status"]],
Status_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["Status_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["Status_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["Status"]],
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
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	serviceEndDate?:boolean | `@${string}`,
	serviceStartDate?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	totalAmount?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	avg?:ResolverInputTypes["EGovernance_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["EGovernance_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["EGovernance_max_fields"],
	min?:ResolverInputTypes["EGovernance_min_fields"],
	stddev?:ResolverInputTypes["EGovernance_stddev_fields"],
	stddev_pop?:ResolverInputTypes["EGovernance_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["EGovernance_stddev_samp_fields"],
	sum?:ResolverInputTypes["EGovernance_sum_fields"],
	var_pop?:ResolverInputTypes["EGovernance_var_pop_fields"],
	var_samp?:ResolverInputTypes["EGovernance_var_samp_fields"],
	variance?:ResolverInputTypes["EGovernance_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["EGovernance_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "EGovernance". All fields are combined with a logical 'AND'. */
["EGovernance_bool_exp"]: {
	_and?: Array<ResolverInputTypes["EGovernance_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["EGovernance_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["EGovernance_bool_exp"]> | undefined | null,
	address?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	area?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	description?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	file?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	phoneNo?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	serviceEndDate?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	serviceStartDate?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["Status_enum_comparison_exp"] | undefined | null,
	totalAmount?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	website?: ResolverInputTypes["String_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "EGovernance" */
["EGovernance_constraint"]:EGovernance_constraint;
	/** input type for incrementing numeric columns in table "EGovernance" */
["EGovernance_inc_input"]: {
	cursorId?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "EGovernance" */
["EGovernance_insert_input"]: {
	address?: string | undefined | null,
	area?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	description?: string | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	phoneNo?: string | undefined | null,
	serviceEndDate?: ResolverInputTypes["date"] | undefined | null,
	serviceStartDate?: ResolverInputTypes["date"] | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	totalAmount?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate max on columns */
["EGovernance_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	serviceEndDate?:boolean | `@${string}`,
	serviceStartDate?:boolean | `@${string}`,
	totalAmount?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	website?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["EGovernance_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	area?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	serviceEndDate?:boolean | `@${string}`,
	serviceStartDate?:boolean | `@${string}`,
	totalAmount?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	description?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	instituteId?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	phoneNo?: ResolverInputTypes["order_by"] | undefined | null,
	serviceEndDate?: ResolverInputTypes["order_by"] | undefined | null,
	serviceStartDate?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	totalAmount?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
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
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	description?: string | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	phoneNo?: string | undefined | null,
	serviceEndDate?: ResolverInputTypes["date"] | undefined | null,
	serviceStartDate?: ResolverInputTypes["date"] | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	totalAmount?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate stddev on columns */
["EGovernance_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["EGovernance_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["EGovernance_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
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
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	description?: string | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	phoneNo?: string | undefined | null,
	serviceEndDate?: ResolverInputTypes["date"] | undefined | null,
	serviceStartDate?: ResolverInputTypes["date"] | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	totalAmount?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate sum on columns */
["EGovernance_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "EGovernance" */
["EGovernance_update_column"]:EGovernance_update_column;
	["EGovernance_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["EGovernance_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["EGovernance_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["EGovernance_bool_exp"]
};
	/** aggregate var_pop on columns */
["EGovernance_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["EGovernance_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["EGovernance_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "Faculty" */
["Faculty"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateOfJoining?:boolean | `@${string}`,
	designation?:boolean | `@${string}`,
	dob?:boolean | `@${string}`,
	emailId?:boolean | `@${string}`,
	experience?:boolean | `@${string}`,
	gender?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	isVerified?:boolean | `@${string}`,
	jobType?:boolean | `@${string}`,
	minority?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	panCardNo?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	qualification?:boolean | `@${string}`,
	section?:boolean | `@${string}`,
	staffType?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	statusOfApproval?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "FacultyFunding" */
["FacultyFunding"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	facultyId?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transactionDate?:boolean | `@${string}`,
	transactionType?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	avg?:ResolverInputTypes["FacultyFunding_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["FacultyFunding_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["FacultyFunding_max_fields"],
	min?:ResolverInputTypes["FacultyFunding_min_fields"],
	stddev?:ResolverInputTypes["FacultyFunding_stddev_fields"],
	stddev_pop?:ResolverInputTypes["FacultyFunding_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["FacultyFunding_stddev_samp_fields"],
	sum?:ResolverInputTypes["FacultyFunding_sum_fields"],
	var_pop?:ResolverInputTypes["FacultyFunding_var_pop_fields"],
	var_samp?:ResolverInputTypes["FacultyFunding_var_samp_fields"],
	variance?:ResolverInputTypes["FacultyFunding_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["FacultyFunding_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "FacultyFunding". All fields are combined with a logical 'AND'. */
["FacultyFunding_bool_exp"]: {
	_and?: Array<ResolverInputTypes["FacultyFunding_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["FacultyFunding_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["FacultyFunding_bool_exp"]> | undefined | null,
	amount?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	facultyId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	file?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	nature?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["Status_enum_comparison_exp"] | undefined | null,
	transactionDate?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	transactionType?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "FacultyFunding" */
["FacultyFunding_constraint"]:FacultyFunding_constraint;
	/** input type for incrementing numeric columns in table "FacultyFunding" */
["FacultyFunding_inc_input"]: {
	cursorId?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "FacultyFunding" */
["FacultyFunding_insert_input"]: {
	amount?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	facultyId?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	nature?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	transactionDate?: ResolverInputTypes["date"] | undefined | null,
	transactionType?: string | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["FacultyFunding_max_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	facultyId?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	transactionDate?:boolean | `@${string}`,
	transactionType?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["FacultyFunding_min_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	facultyId?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	transactionDate?:boolean | `@${string}`,
	transactionType?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	facultyId?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	instituteId?: ResolverInputTypes["order_by"] | undefined | null,
	nature?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	transactionDate?: ResolverInputTypes["order_by"] | undefined | null,
	transactionType?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null
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
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	facultyId?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	nature?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	transactionDate?: ResolverInputTypes["date"] | undefined | null,
	transactionType?: string | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate stddev on columns */
["FacultyFunding_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["FacultyFunding_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["FacultyFunding_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
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
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	facultyId?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	nature?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	transactionDate?: ResolverInputTypes["date"] | undefined | null,
	transactionType?: string | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate sum on columns */
["FacultyFunding_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "FacultyFunding" */
["FacultyFunding_update_column"]:FacultyFunding_update_column;
	["FacultyFunding_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["FacultyFunding_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["FacultyFunding_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["FacultyFunding_bool_exp"]
};
	/** aggregate var_pop on columns */
["FacultyFunding_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["FacultyFunding_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["FacultyFunding_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "Faculty" */
["Faculty_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["Faculty_aggregate_fields"],
	nodes?:ResolverInputTypes["Faculty"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "Faculty" */
["Faculty_aggregate_fields"]: AliasType<{
	avg?:ResolverInputTypes["Faculty_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["Faculty_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["Faculty_max_fields"],
	min?:ResolverInputTypes["Faculty_min_fields"],
	stddev?:ResolverInputTypes["Faculty_stddev_fields"],
	stddev_pop?:ResolverInputTypes["Faculty_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["Faculty_stddev_samp_fields"],
	sum?:ResolverInputTypes["Faculty_sum_fields"],
	var_pop?:ResolverInputTypes["Faculty_var_pop_fields"],
	var_samp?:ResolverInputTypes["Faculty_var_samp_fields"],
	variance?:ResolverInputTypes["Faculty_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["Faculty_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "Faculty". All fields are combined with a logical 'AND'. */
["Faculty_bool_exp"]: {
	_and?: Array<ResolverInputTypes["Faculty_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["Faculty_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["Faculty_bool_exp"]> | undefined | null,
	address?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	cast?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	dateOfJoining?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	designation?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	dob?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	emailId?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	experience?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	gender?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	isVerified?: ResolverInputTypes["Boolean_comparison_exp"] | undefined | null,
	jobType?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	minority?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	panCardNo?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	phoneNo?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	qualification?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	section?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	staffType?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["Status_enum_comparison_exp"] | undefined | null,
	statusOfApproval?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "Faculty" */
["Faculty_constraint"]:Faculty_constraint;
	/** input type for incrementing numeric columns in table "Faculty" */
["Faculty_inc_input"]: {
	cursorId?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "Faculty" */
["Faculty_insert_input"]: {
	address?: string | undefined | null,
	cast?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	dateOfJoining?: ResolverInputTypes["date"] | undefined | null,
	designation?: string | undefined | null,
	dob?: ResolverInputTypes["date"] | undefined | null,
	emailId?: string | undefined | null,
	experience?: string | undefined | null,
	gender?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	isVerified?: boolean | undefined | null,
	jobType?: string | undefined | null,
	minority?: string | undefined | null,
	name?: string | undefined | null,
	panCardNo?: string | undefined | null,
	phoneNo?: string | undefined | null,
	qualification?: string | undefined | null,
	section?: string | undefined | null,
	staffType?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	statusOfApproval?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["Faculty_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateOfJoining?:boolean | `@${string}`,
	designation?:boolean | `@${string}`,
	dob?:boolean | `@${string}`,
	emailId?:boolean | `@${string}`,
	experience?:boolean | `@${string}`,
	gender?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	jobType?:boolean | `@${string}`,
	minority?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	panCardNo?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	qualification?:boolean | `@${string}`,
	section?:boolean | `@${string}`,
	staffType?:boolean | `@${string}`,
	statusOfApproval?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["Faculty_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	cast?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateOfJoining?:boolean | `@${string}`,
	designation?:boolean | `@${string}`,
	dob?:boolean | `@${string}`,
	emailId?:boolean | `@${string}`,
	experience?:boolean | `@${string}`,
	gender?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	jobType?:boolean | `@${string}`,
	minority?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	panCardNo?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	qualification?:boolean | `@${string}`,
	section?:boolean | `@${string}`,
	staffType?:boolean | `@${string}`,
	statusOfApproval?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	dateOfJoining?: ResolverInputTypes["order_by"] | undefined | null,
	designation?: ResolverInputTypes["order_by"] | undefined | null,
	dob?: ResolverInputTypes["order_by"] | undefined | null,
	emailId?: ResolverInputTypes["order_by"] | undefined | null,
	experience?: ResolverInputTypes["order_by"] | undefined | null,
	gender?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	instituteId?: ResolverInputTypes["order_by"] | undefined | null,
	isVerified?: ResolverInputTypes["order_by"] | undefined | null,
	jobType?: ResolverInputTypes["order_by"] | undefined | null,
	minority?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	panCardNo?: ResolverInputTypes["order_by"] | undefined | null,
	phoneNo?: ResolverInputTypes["order_by"] | undefined | null,
	qualification?: ResolverInputTypes["order_by"] | undefined | null,
	section?: ResolverInputTypes["order_by"] | undefined | null,
	staffType?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	statusOfApproval?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null
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
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	dateOfJoining?: ResolverInputTypes["date"] | undefined | null,
	designation?: string | undefined | null,
	dob?: ResolverInputTypes["date"] | undefined | null,
	emailId?: string | undefined | null,
	experience?: string | undefined | null,
	gender?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	isVerified?: boolean | undefined | null,
	jobType?: string | undefined | null,
	minority?: string | undefined | null,
	name?: string | undefined | null,
	panCardNo?: string | undefined | null,
	phoneNo?: string | undefined | null,
	qualification?: string | undefined | null,
	section?: string | undefined | null,
	staffType?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	statusOfApproval?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate stddev on columns */
["Faculty_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["Faculty_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["Faculty_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
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
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	dateOfJoining?: ResolverInputTypes["date"] | undefined | null,
	designation?: string | undefined | null,
	dob?: ResolverInputTypes["date"] | undefined | null,
	emailId?: string | undefined | null,
	experience?: string | undefined | null,
	gender?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	isVerified?: boolean | undefined | null,
	jobType?: string | undefined | null,
	minority?: string | undefined | null,
	name?: string | undefined | null,
	panCardNo?: string | undefined | null,
	phoneNo?: string | undefined | null,
	qualification?: string | undefined | null,
	section?: string | undefined | null,
	staffType?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	statusOfApproval?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate sum on columns */
["Faculty_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "Faculty" */
["Faculty_update_column"]:Faculty_update_column;
	["Faculty_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["Faculty_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Faculty_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["Faculty_bool_exp"]
};
	/** aggregate var_pop on columns */
["Faculty_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["Faculty_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["Faculty_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "FdpPdp" */
["FdpPdp"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateFrom?:boolean | `@${string}`,
	dateTo?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	facultyId?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	avg?:ResolverInputTypes["FdpPdp_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["FdpPdp_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["FdpPdp_max_fields"],
	min?:ResolverInputTypes["FdpPdp_min_fields"],
	stddev?:ResolverInputTypes["FdpPdp_stddev_fields"],
	stddev_pop?:ResolverInputTypes["FdpPdp_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["FdpPdp_stddev_samp_fields"],
	sum?:ResolverInputTypes["FdpPdp_sum_fields"],
	var_pop?:ResolverInputTypes["FdpPdp_var_pop_fields"],
	var_samp?:ResolverInputTypes["FdpPdp_var_samp_fields"],
	variance?:ResolverInputTypes["FdpPdp_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["FdpPdp_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "FdpPdp". All fields are combined with a logical 'AND'. */
["FdpPdp_bool_exp"]: {
	_and?: Array<ResolverInputTypes["FdpPdp_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["FdpPdp_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["FdpPdp_bool_exp"]> | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	dateFrom?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	dateTo?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	description?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	facultyId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	file?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	nature?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["Status_enum_comparison_exp"] | undefined | null,
	type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	venue?: ResolverInputTypes["String_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "FdpPdp" */
["FdpPdp_constraint"]:FdpPdp_constraint;
	/** input type for incrementing numeric columns in table "FdpPdp" */
["FdpPdp_inc_input"]: {
	cursorId?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "FdpPdp" */
["FdpPdp_insert_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	dateFrom?: ResolverInputTypes["date"] | undefined | null,
	dateTo?: ResolverInputTypes["date"] | undefined | null,
	description?: string | undefined | null,
	facultyId?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	nature?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	venue?: string | undefined | null
};
	/** aggregate max on columns */
["FdpPdp_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateFrom?:boolean | `@${string}`,
	dateTo?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	facultyId?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
	venue?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["FdpPdp_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateFrom?:boolean | `@${string}`,
	dateTo?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	facultyId?:boolean | `@${string}`,
	file?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	nature?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	dateFrom?: ResolverInputTypes["order_by"] | undefined | null,
	dateTo?: ResolverInputTypes["order_by"] | undefined | null,
	description?: ResolverInputTypes["order_by"] | undefined | null,
	facultyId?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	instituteId?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	nature?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null,
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
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	dateFrom?: ResolverInputTypes["date"] | undefined | null,
	dateTo?: ResolverInputTypes["date"] | undefined | null,
	description?: string | undefined | null,
	facultyId?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	nature?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	venue?: string | undefined | null
};
	/** aggregate stddev on columns */
["FdpPdp_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["FdpPdp_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["FdpPdp_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Streaming cursor of the table "FdpPdp" */
["FdpPdp_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["FdpPdp_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["FdpPdp_stream_cursor_value_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	dateFrom?: ResolverInputTypes["date"] | undefined | null,
	dateTo?: ResolverInputTypes["date"] | undefined | null,
	description?: string | undefined | null,
	facultyId?: ResolverInputTypes["uuid"] | undefined | null,
	file?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	nature?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	venue?: string | undefined | null
};
	/** aggregate sum on columns */
["FdpPdp_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "FdpPdp" */
["FdpPdp_update_column"]:FdpPdp_update_column;
	["FdpPdp_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["FdpPdp_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["FdpPdp_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["FdpPdp_bool_exp"]
};
	/** aggregate var_pop on columns */
["FdpPdp_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["FdpPdp_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["FdpPdp_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "Genesis" */
["Genesis"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	emailId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isVerified?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
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
	createdAt?: ResolverInputTypes["timestamp_comparison_exp"] | undefined | null,
	emailId?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	isVerified?: ResolverInputTypes["Boolean_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	phoneNo?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	role?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamp_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "Genesis" */
["Genesis_constraint"]:Genesis_constraint;
	/** input type for inserting data into table "Genesis" */
["Genesis_insert_input"]: {
	createdAt?: ResolverInputTypes["timestamp"] | undefined | null,
	emailId?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isVerified?: boolean | undefined | null,
	name?: string | undefined | null,
	phoneNo?: string | undefined | null,
	role?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamp"] | undefined | null
};
	/** aggregate max on columns */
["Genesis_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	emailId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["Genesis_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	emailId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phoneNo?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
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
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	emailId?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	isVerified?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	phoneNo?: ResolverInputTypes["order_by"] | undefined | null,
	role?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: Genesis */
["Genesis_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "Genesis" */
["Genesis_select_column"]:Genesis_select_column;
	/** input type for updating data in table "Genesis" */
["Genesis_set_input"]: {
	createdAt?: ResolverInputTypes["timestamp"] | undefined | null,
	emailId?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isVerified?: boolean | undefined | null,
	name?: string | undefined | null,
	phoneNo?: string | undefined | null,
	role?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamp"] | undefined | null
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
	createdAt?: ResolverInputTypes["timestamp"] | undefined | null,
	emailId?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isVerified?: boolean | undefined | null,
	name?: string | undefined | null,
	phoneNo?: string | undefined | null,
	role?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamp"] | undefined | null
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
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateOfEstablishment?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isVerified?:boolean | `@${string}`,
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
	/** columns and relationships of "InstituteFunding" */
["InstituteFunding"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	status?:boolean | `@${string}`,
	transactionDate?:boolean | `@${string}`,
	transactionType?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	avg?:ResolverInputTypes["InstituteFunding_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["InstituteFunding_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["InstituteFunding_max_fields"],
	min?:ResolverInputTypes["InstituteFunding_min_fields"],
	stddev?:ResolverInputTypes["InstituteFunding_stddev_fields"],
	stddev_pop?:ResolverInputTypes["InstituteFunding_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["InstituteFunding_stddev_samp_fields"],
	sum?:ResolverInputTypes["InstituteFunding_sum_fields"],
	var_pop?:ResolverInputTypes["InstituteFunding_var_pop_fields"],
	var_samp?:ResolverInputTypes["InstituteFunding_var_samp_fields"],
	variance?:ResolverInputTypes["InstituteFunding_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["InstituteFunding_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "InstituteFunding". All fields are combined with a logical 'AND'. */
["InstituteFunding_bool_exp"]: {
	_and?: Array<ResolverInputTypes["InstituteFunding_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["InstituteFunding_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["InstituteFunding_bool_exp"]> | undefined | null,
	amount?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	purpose?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["Status_enum_comparison_exp"] | undefined | null,
	transactionDate?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	transactionType?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "InstituteFunding" */
["InstituteFunding_constraint"]:InstituteFunding_constraint;
	/** input type for incrementing numeric columns in table "InstituteFunding" */
["InstituteFunding_inc_input"]: {
	cursorId?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "InstituteFunding" */
["InstituteFunding_insert_input"]: {
	amount?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	purpose?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	transactionDate?: ResolverInputTypes["date"] | undefined | null,
	transactionType?: string | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["InstituteFunding_max_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	transactionDate?:boolean | `@${string}`,
	transactionType?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["InstituteFunding_min_fields"]: AliasType<{
	amount?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	instituteId?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	purpose?:boolean | `@${string}`,
	transactionDate?:boolean | `@${string}`,
	transactionType?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	updatedById?:boolean | `@${string}`,
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
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	instituteId?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	purpose?: ResolverInputTypes["order_by"] | undefined | null,
	status?: ResolverInputTypes["order_by"] | undefined | null,
	transactionDate?: ResolverInputTypes["order_by"] | undefined | null,
	transactionType?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedById?: ResolverInputTypes["order_by"] | undefined | null
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
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	purpose?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	transactionDate?: ResolverInputTypes["date"] | undefined | null,
	transactionType?: string | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate stddev on columns */
["InstituteFunding_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["InstituteFunding_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["InstituteFunding_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
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
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	instituteId?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	purpose?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	transactionDate?: ResolverInputTypes["date"] | undefined | null,
	transactionType?: string | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate sum on columns */
["InstituteFunding_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "InstituteFunding" */
["InstituteFunding_update_column"]:InstituteFunding_update_column;
	["InstituteFunding_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["InstituteFunding_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["InstituteFunding_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["InstituteFunding_bool_exp"]
};
	/** aggregate var_pop on columns */
["InstituteFunding_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["InstituteFunding_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["InstituteFunding_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "Institute" */
["Institute_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["Institute_aggregate_fields"],
	nodes?:ResolverInputTypes["Institute"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "Institute" */
["Institute_aggregate_fields"]: AliasType<{
	avg?:ResolverInputTypes["Institute_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["Institute_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["Institute_max_fields"],
	min?:ResolverInputTypes["Institute_min_fields"],
	stddev?:ResolverInputTypes["Institute_stddev_fields"],
	stddev_pop?:ResolverInputTypes["Institute_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["Institute_stddev_samp_fields"],
	sum?:ResolverInputTypes["Institute_sum_fields"],
	var_pop?:ResolverInputTypes["Institute_var_pop_fields"],
	var_samp?:ResolverInputTypes["Institute_var_samp_fields"],
	variance?:ResolverInputTypes["Institute_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["Institute_avg_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "Institute". All fields are combined with a logical 'AND'. */
["Institute_bool_exp"]: {
	_and?: Array<ResolverInputTypes["Institute_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["Institute_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["Institute_bool_exp"]> | undefined | null,
	address?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	city?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	createdById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	dateOfEstablishment?: ResolverInputTypes["date_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	isVerified?: ResolverInputTypes["Boolean_comparison_exp"] | undefined | null,
	landmark?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	pin?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	state?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	status?: ResolverInputTypes["Status_enum_comparison_exp"] | undefined | null,
	type?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	website?: ResolverInputTypes["String_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "Institute" */
["Institute_constraint"]:Institute_constraint;
	/** input type for incrementing numeric columns in table "Institute" */
["Institute_inc_input"]: {
	cursorId?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "Institute" */
["Institute_insert_input"]: {
	address?: string | undefined | null,
	city?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	dateOfEstablishment?: ResolverInputTypes["date"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isVerified?: boolean | undefined | null,
	landmark?: string | undefined | null,
	name?: string | undefined | null,
	pin?: string | undefined | null,
	state?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate max on columns */
["Institute_max_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateOfEstablishment?:boolean | `@${string}`,
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
["Institute_min_fields"]: AliasType<{
	address?:boolean | `@${string}`,
	city?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	createdById?:boolean | `@${string}`,
	cursorId?:boolean | `@${string}`,
	dateOfEstablishment?:boolean | `@${string}`,
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
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	createdById?: ResolverInputTypes["order_by"] | undefined | null,
	cursorId?: ResolverInputTypes["order_by"] | undefined | null,
	dateOfEstablishment?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	isVerified?: ResolverInputTypes["order_by"] | undefined | null,
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
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	dateOfEstablishment?: ResolverInputTypes["date"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isVerified?: boolean | undefined | null,
	landmark?: string | undefined | null,
	name?: string | undefined | null,
	pin?: string | undefined | null,
	state?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate stddev on columns */
["Institute_stddev_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["Institute_stddev_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["Institute_stddev_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
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
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	createdById?: ResolverInputTypes["uuid"] | undefined | null,
	cursorId?: ResolverInputTypes["bigint"] | undefined | null,
	dateOfEstablishment?: ResolverInputTypes["date"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isVerified?: boolean | undefined | null,
	landmark?: string | undefined | null,
	name?: string | undefined | null,
	pin?: string | undefined | null,
	state?: string | undefined | null,
	status?: ResolverInputTypes["Status_enum"] | undefined | null,
	type?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedById?: ResolverInputTypes["uuid"] | undefined | null,
	website?: string | undefined | null
};
	/** aggregate sum on columns */
["Institute_sum_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "Institute" */
["Institute_update_column"]:Institute_update_column;
	["Institute_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["Institute_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Institute_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["Institute_bool_exp"]
};
	/** aggregate var_pop on columns */
["Institute_var_pop_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["Institute_var_samp_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["Institute_variance_fields"]: AliasType<{
	cursorId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** columns and relationships of "Status" */
["Status"]: AliasType<{
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "Status" */
["Status_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["Status_aggregate_fields"],
	nodes?:ResolverInputTypes["Status"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "Status" */
["Status_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["Status_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["Status_max_fields"],
	min?:ResolverInputTypes["Status_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "Status". All fields are combined with a logical 'AND'. */
["Status_bool_exp"]: {
	_and?: Array<ResolverInputTypes["Status_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["Status_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["Status_bool_exp"]> | undefined | null,
	value?: ResolverInputTypes["String_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "Status" */
["Status_constraint"]:Status_constraint;
	["Status_enum"]:Status_enum;
	/** Boolean expression to compare columns of type "Status_enum". All fields are combined with logical 'AND'. */
["Status_enum_comparison_exp"]: {
	_eq?: ResolverInputTypes["Status_enum"] | undefined | null,
	_in?: Array<ResolverInputTypes["Status_enum"]> | undefined | null,
	_is_null?: boolean | undefined | null,
	_neq?: ResolverInputTypes["Status_enum"] | undefined | null,
	_nin?: Array<ResolverInputTypes["Status_enum"]> | undefined | null
};
	/** input type for inserting data into table "Status" */
["Status_insert_input"]: {
	value?: string | undefined | null
};
	/** aggregate max on columns */
["Status_max_fields"]: AliasType<{
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["Status_min_fields"]: AliasType<{
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "Status" */
["Status_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["Status"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "Status" */
["Status_on_conflict"]: {
	constraint: ResolverInputTypes["Status_constraint"],
	update_columns: Array<ResolverInputTypes["Status_update_column"]>,
	where?: ResolverInputTypes["Status_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "Status". */
["Status_order_by"]: {
	value?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: Status */
["Status_pk_columns_input"]: {
	value: string
};
	/** select columns of table "Status" */
["Status_select_column"]:Status_select_column;
	/** input type for updating data in table "Status" */
["Status_set_input"]: {
	value?: string | undefined | null
};
	/** Streaming cursor of the table "Status" */
["Status_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["Status_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["Status_stream_cursor_value_input"]: {
	value?: string | undefined | null
};
	/** update columns of table "Status" */
["Status_update_column"]:Status_update_column;
	["Status_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Status_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["Status_bool_exp"]
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
delete_Status?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["Status_bool_exp"]},ResolverInputTypes["Status_mutation_response"]],
delete_Status_by_pk?: [{	value: string},ResolverInputTypes["Status"]],
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
insert_Status?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["Status_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["Status_on_conflict"] | undefined | null},ResolverInputTypes["Status_mutation_response"]],
insert_Status_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["Status_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["Status_on_conflict"] | undefined | null},ResolverInputTypes["Status"]],
update_EGovernance?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["EGovernance_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["EGovernance_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["EGovernance_bool_exp"]},ResolverInputTypes["EGovernance_mutation_response"]],
update_EGovernance_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["EGovernance_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["EGovernance_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["EGovernance_pk_columns_input"]},ResolverInputTypes["EGovernance"]],
update_EGovernance_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["EGovernance_updates"]>},ResolverInputTypes["EGovernance_mutation_response"]],
update_Faculty?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["Faculty_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Faculty_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["Faculty_bool_exp"]},ResolverInputTypes["Faculty_mutation_response"]],
update_FacultyFunding?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["FacultyFunding_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["FacultyFunding_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["FacultyFunding_bool_exp"]},ResolverInputTypes["FacultyFunding_mutation_response"]],
update_FacultyFunding_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["FacultyFunding_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["FacultyFunding_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["FacultyFunding_pk_columns_input"]},ResolverInputTypes["FacultyFunding"]],
update_FacultyFunding_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["FacultyFunding_updates"]>},ResolverInputTypes["FacultyFunding_mutation_response"]],
update_Faculty_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["Faculty_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Faculty_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["Faculty_pk_columns_input"]},ResolverInputTypes["Faculty"]],
update_Faculty_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["Faculty_updates"]>},ResolverInputTypes["Faculty_mutation_response"]],
update_FdpPdp?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["FdpPdp_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["FdpPdp_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["FdpPdp_bool_exp"]},ResolverInputTypes["FdpPdp_mutation_response"]],
update_FdpPdp_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["FdpPdp_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
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
update_Institute?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["Institute_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Institute_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["Institute_bool_exp"]},ResolverInputTypes["Institute_mutation_response"]],
update_InstituteFunding?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["InstituteFunding_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["InstituteFunding_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["InstituteFunding_bool_exp"]},ResolverInputTypes["InstituteFunding_mutation_response"]],
update_InstituteFunding_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["InstituteFunding_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["InstituteFunding_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["InstituteFunding_pk_columns_input"]},ResolverInputTypes["InstituteFunding"]],
update_InstituteFunding_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["InstituteFunding_updates"]>},ResolverInputTypes["InstituteFunding_mutation_response"]],
update_Institute_by_pk?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["Institute_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Institute_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["Institute_pk_columns_input"]},ResolverInputTypes["Institute"]],
update_Institute_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["Institute_updates"]>},ResolverInputTypes["Institute_mutation_response"]],
update_Status?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Status_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["Status_bool_exp"]},ResolverInputTypes["Status_mutation_response"]],
update_Status_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["Status_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["Status_pk_columns_input"]},ResolverInputTypes["Status"]],
update_Status_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["Status_updates"]>},ResolverInputTypes["Status_mutation_response"]],
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
Status?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Status_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Status_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Status_bool_exp"] | undefined | null},ResolverInputTypes["Status"]],
Status_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Status_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Status_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Status_bool_exp"] | undefined | null},ResolverInputTypes["Status_aggregate"]],
Status_by_pk?: [{	value: string},ResolverInputTypes["Status"]],
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
Status?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Status_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Status_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Status_bool_exp"] | undefined | null},ResolverInputTypes["Status"]],
Status_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["Status_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["Status_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["Status_bool_exp"] | undefined | null},ResolverInputTypes["Status_aggregate"]],
Status_by_pk?: [{	value: string},ResolverInputTypes["Status"]],
Status_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["Status_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["Status_bool_exp"] | undefined | null},ResolverInputTypes["Status"]],
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
	createdAt: ModelTypes["timestamptz"],
	createdById: ModelTypes["uuid"],
	cursorId: ModelTypes["bigint"],
	description: string,
	file: string,
	id: ModelTypes["uuid"],
	instituteId: ModelTypes["uuid"],
	name: string,
	phoneNo: string,
	serviceEndDate: ModelTypes["date"],
	serviceStartDate: ModelTypes["date"],
	status: ModelTypes["Status_enum"],
	totalAmount: string,
	updatedAt: ModelTypes["timestamptz"],
	updatedById?: ModelTypes["uuid"] | undefined,
	website: string
};
	/** aggregated selection of "EGovernance" */
["EGovernance_aggregate"]: {
		aggregate?: ModelTypes["EGovernance_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["EGovernance"]>
};
	/** aggregate fields of "EGovernance" */
["EGovernance_aggregate_fields"]: {
		avg?: ModelTypes["EGovernance_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["EGovernance_max_fields"] | undefined,
	min?: ModelTypes["EGovernance_min_fields"] | undefined,
	stddev?: ModelTypes["EGovernance_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["EGovernance_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["EGovernance_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["EGovernance_sum_fields"] | undefined,
	var_pop?: ModelTypes["EGovernance_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["EGovernance_var_samp_fields"] | undefined,
	variance?: ModelTypes["EGovernance_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["EGovernance_avg_fields"]: {
		cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "EGovernance". All fields are combined with a logical 'AND'. */
["EGovernance_bool_exp"]: {
	_and?: Array<ModelTypes["EGovernance_bool_exp"]> | undefined,
	_not?: ModelTypes["EGovernance_bool_exp"] | undefined,
	_or?: Array<ModelTypes["EGovernance_bool_exp"]> | undefined,
	address?: ModelTypes["String_comparison_exp"] | undefined,
	area?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursorId?: ModelTypes["bigint_comparison_exp"] | undefined,
	description?: ModelTypes["String_comparison_exp"] | undefined,
	file?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	instituteId?: ModelTypes["uuid_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	phoneNo?: ModelTypes["String_comparison_exp"] | undefined,
	serviceEndDate?: ModelTypes["date_comparison_exp"] | undefined,
	serviceStartDate?: ModelTypes["date_comparison_exp"] | undefined,
	status?: ModelTypes["Status_enum_comparison_exp"] | undefined,
	totalAmount?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined,
	website?: ModelTypes["String_comparison_exp"] | undefined
};
	["EGovernance_constraint"]:EGovernance_constraint;
	/** input type for incrementing numeric columns in table "EGovernance" */
["EGovernance_inc_input"]: {
	cursorId?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "EGovernance" */
["EGovernance_insert_input"]: {
	address?: string | undefined,
	area?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	serviceEndDate?: ModelTypes["date"] | undefined,
	serviceStartDate?: ModelTypes["date"] | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	totalAmount?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate max on columns */
["EGovernance_max_fields"]: {
		address?: string | undefined,
	area?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	serviceEndDate?: ModelTypes["date"] | undefined,
	serviceStartDate?: ModelTypes["date"] | undefined,
	totalAmount?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate min on columns */
["EGovernance_min_fields"]: {
		address?: string | undefined,
	area?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	serviceEndDate?: ModelTypes["date"] | undefined,
	serviceStartDate?: ModelTypes["date"] | undefined,
	totalAmount?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
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
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	description?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	instituteId?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	phoneNo?: ModelTypes["order_by"] | undefined,
	serviceEndDate?: ModelTypes["order_by"] | undefined,
	serviceStartDate?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	totalAmount?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
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
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	serviceEndDate?: ModelTypes["date"] | undefined,
	serviceStartDate?: ModelTypes["date"] | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	totalAmount?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate stddev on columns */
["EGovernance_stddev_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["EGovernance_stddev_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["EGovernance_stddev_samp_fields"]: {
		cursorId?: number | undefined
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
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	serviceEndDate?: ModelTypes["date"] | undefined,
	serviceStartDate?: ModelTypes["date"] | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	totalAmount?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate sum on columns */
["EGovernance_sum_fields"]: {
		cursorId?: ModelTypes["bigint"] | undefined
};
	["EGovernance_update_column"]:EGovernance_update_column;
	["EGovernance_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["EGovernance_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["EGovernance_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["EGovernance_bool_exp"]
};
	/** aggregate var_pop on columns */
["EGovernance_var_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["EGovernance_var_samp_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate variance on columns */
["EGovernance_variance_fields"]: {
		cursorId?: number | undefined
};
	/** columns and relationships of "Faculty" */
["Faculty"]: {
		address: string,
	cast: string,
	createdAt: ModelTypes["timestamptz"],
	createdById: ModelTypes["uuid"],
	cursorId: ModelTypes["bigint"],
	dateOfJoining: ModelTypes["date"],
	designation: string,
	dob: ModelTypes["date"],
	emailId: string,
	experience: string,
	gender: string,
	id: ModelTypes["uuid"],
	instituteId: ModelTypes["uuid"],
	isVerified: boolean,
	jobType: string,
	minority: string,
	name: string,
	panCardNo: string,
	phoneNo: string,
	qualification: string,
	section: string,
	staffType: string,
	status: ModelTypes["Status_enum"],
	statusOfApproval: string,
	updatedAt: ModelTypes["timestamptz"],
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** columns and relationships of "FacultyFunding" */
["FacultyFunding"]: {
		amount: string,
	createdAt: ModelTypes["timestamptz"],
	createdById: ModelTypes["uuid"],
	cursorId: ModelTypes["bigint"],
	facultyId: ModelTypes["uuid"],
	file: string,
	id: ModelTypes["uuid"],
	instituteId: ModelTypes["uuid"],
	nature: string,
	status: ModelTypes["Status_enum"],
	transactionDate: ModelTypes["date"],
	transactionType: string,
	type: string,
	updatedAt: ModelTypes["timestamptz"],
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregated selection of "FacultyFunding" */
["FacultyFunding_aggregate"]: {
		aggregate?: ModelTypes["FacultyFunding_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["FacultyFunding"]>
};
	/** aggregate fields of "FacultyFunding" */
["FacultyFunding_aggregate_fields"]: {
		avg?: ModelTypes["FacultyFunding_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["FacultyFunding_max_fields"] | undefined,
	min?: ModelTypes["FacultyFunding_min_fields"] | undefined,
	stddev?: ModelTypes["FacultyFunding_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["FacultyFunding_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["FacultyFunding_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["FacultyFunding_sum_fields"] | undefined,
	var_pop?: ModelTypes["FacultyFunding_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["FacultyFunding_var_samp_fields"] | undefined,
	variance?: ModelTypes["FacultyFunding_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["FacultyFunding_avg_fields"]: {
		cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "FacultyFunding". All fields are combined with a logical 'AND'. */
["FacultyFunding_bool_exp"]: {
	_and?: Array<ModelTypes["FacultyFunding_bool_exp"]> | undefined,
	_not?: ModelTypes["FacultyFunding_bool_exp"] | undefined,
	_or?: Array<ModelTypes["FacultyFunding_bool_exp"]> | undefined,
	amount?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursorId?: ModelTypes["bigint_comparison_exp"] | undefined,
	facultyId?: ModelTypes["uuid_comparison_exp"] | undefined,
	file?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	instituteId?: ModelTypes["uuid_comparison_exp"] | undefined,
	nature?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["Status_enum_comparison_exp"] | undefined,
	transactionDate?: ModelTypes["date_comparison_exp"] | undefined,
	transactionType?: ModelTypes["String_comparison_exp"] | undefined,
	type?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["FacultyFunding_constraint"]:FacultyFunding_constraint;
	/** input type for incrementing numeric columns in table "FacultyFunding" */
["FacultyFunding_inc_input"]: {
	cursorId?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "FacultyFunding" */
["FacultyFunding_insert_input"]: {
	amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	facultyId?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	transactionDate?: ModelTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["FacultyFunding_max_fields"]: {
		amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	facultyId?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	transactionDate?: ModelTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate min on columns */
["FacultyFunding_min_fields"]: {
		amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	facultyId?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	transactionDate?: ModelTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
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
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	facultyId?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	instituteId?: ModelTypes["order_by"] | undefined,
	nature?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	transactionDate?: ModelTypes["order_by"] | undefined,
	transactionType?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: FacultyFunding */
["FacultyFunding_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["FacultyFunding_select_column"]:FacultyFunding_select_column;
	/** input type for updating data in table "FacultyFunding" */
["FacultyFunding_set_input"]: {
	amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	facultyId?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	transactionDate?: ModelTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["FacultyFunding_stddev_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["FacultyFunding_stddev_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["FacultyFunding_stddev_samp_fields"]: {
		cursorId?: number | undefined
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
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	facultyId?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	transactionDate?: ModelTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["FacultyFunding_sum_fields"]: {
		cursorId?: ModelTypes["bigint"] | undefined
};
	["FacultyFunding_update_column"]:FacultyFunding_update_column;
	["FacultyFunding_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["FacultyFunding_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["FacultyFunding_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["FacultyFunding_bool_exp"]
};
	/** aggregate var_pop on columns */
["FacultyFunding_var_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["FacultyFunding_var_samp_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate variance on columns */
["FacultyFunding_variance_fields"]: {
		cursorId?: number | undefined
};
	/** aggregated selection of "Faculty" */
["Faculty_aggregate"]: {
		aggregate?: ModelTypes["Faculty_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["Faculty"]>
};
	/** aggregate fields of "Faculty" */
["Faculty_aggregate_fields"]: {
		avg?: ModelTypes["Faculty_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["Faculty_max_fields"] | undefined,
	min?: ModelTypes["Faculty_min_fields"] | undefined,
	stddev?: ModelTypes["Faculty_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["Faculty_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["Faculty_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["Faculty_sum_fields"] | undefined,
	var_pop?: ModelTypes["Faculty_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["Faculty_var_samp_fields"] | undefined,
	variance?: ModelTypes["Faculty_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["Faculty_avg_fields"]: {
		cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "Faculty". All fields are combined with a logical 'AND'. */
["Faculty_bool_exp"]: {
	_and?: Array<ModelTypes["Faculty_bool_exp"]> | undefined,
	_not?: ModelTypes["Faculty_bool_exp"] | undefined,
	_or?: Array<ModelTypes["Faculty_bool_exp"]> | undefined,
	address?: ModelTypes["String_comparison_exp"] | undefined,
	cast?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursorId?: ModelTypes["bigint_comparison_exp"] | undefined,
	dateOfJoining?: ModelTypes["date_comparison_exp"] | undefined,
	designation?: ModelTypes["String_comparison_exp"] | undefined,
	dob?: ModelTypes["date_comparison_exp"] | undefined,
	emailId?: ModelTypes["String_comparison_exp"] | undefined,
	experience?: ModelTypes["String_comparison_exp"] | undefined,
	gender?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	instituteId?: ModelTypes["uuid_comparison_exp"] | undefined,
	isVerified?: ModelTypes["Boolean_comparison_exp"] | undefined,
	jobType?: ModelTypes["String_comparison_exp"] | undefined,
	minority?: ModelTypes["String_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	panCardNo?: ModelTypes["String_comparison_exp"] | undefined,
	phoneNo?: ModelTypes["String_comparison_exp"] | undefined,
	qualification?: ModelTypes["String_comparison_exp"] | undefined,
	section?: ModelTypes["String_comparison_exp"] | undefined,
	staffType?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["Status_enum_comparison_exp"] | undefined,
	statusOfApproval?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["Faculty_constraint"]:Faculty_constraint;
	/** input type for incrementing numeric columns in table "Faculty" */
["Faculty_inc_input"]: {
	cursorId?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "Faculty" */
["Faculty_insert_input"]: {
	address?: string | undefined,
	cast?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateOfJoining?: ModelTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: ModelTypes["date"] | undefined,
	emailId?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	jobType?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	panCardNo?: string | undefined,
	phoneNo?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staffType?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	statusOfApproval?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["Faculty_max_fields"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateOfJoining?: ModelTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: ModelTypes["date"] | undefined,
	emailId?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	jobType?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	panCardNo?: string | undefined,
	phoneNo?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staffType?: string | undefined,
	statusOfApproval?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate min on columns */
["Faculty_min_fields"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateOfJoining?: ModelTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: ModelTypes["date"] | undefined,
	emailId?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	jobType?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	panCardNo?: string | undefined,
	phoneNo?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staffType?: string | undefined,
	statusOfApproval?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
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
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	dateOfJoining?: ModelTypes["order_by"] | undefined,
	designation?: ModelTypes["order_by"] | undefined,
	dob?: ModelTypes["order_by"] | undefined,
	emailId?: ModelTypes["order_by"] | undefined,
	experience?: ModelTypes["order_by"] | undefined,
	gender?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	instituteId?: ModelTypes["order_by"] | undefined,
	isVerified?: ModelTypes["order_by"] | undefined,
	jobType?: ModelTypes["order_by"] | undefined,
	minority?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	panCardNo?: ModelTypes["order_by"] | undefined,
	phoneNo?: ModelTypes["order_by"] | undefined,
	qualification?: ModelTypes["order_by"] | undefined,
	section?: ModelTypes["order_by"] | undefined,
	staffType?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	statusOfApproval?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined
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
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateOfJoining?: ModelTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: ModelTypes["date"] | undefined,
	emailId?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	jobType?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	panCardNo?: string | undefined,
	phoneNo?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staffType?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	statusOfApproval?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["Faculty_stddev_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["Faculty_stddev_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["Faculty_stddev_samp_fields"]: {
		cursorId?: number | undefined
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
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateOfJoining?: ModelTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: ModelTypes["date"] | undefined,
	emailId?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	jobType?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	panCardNo?: string | undefined,
	phoneNo?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staffType?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	statusOfApproval?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["Faculty_sum_fields"]: {
		cursorId?: ModelTypes["bigint"] | undefined
};
	["Faculty_update_column"]:Faculty_update_column;
	["Faculty_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["Faculty_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["Faculty_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["Faculty_bool_exp"]
};
	/** aggregate var_pop on columns */
["Faculty_var_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["Faculty_var_samp_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate variance on columns */
["Faculty_variance_fields"]: {
		cursorId?: number | undefined
};
	/** columns and relationships of "FdpPdp" */
["FdpPdp"]: {
		createdAt: ModelTypes["timestamptz"],
	createdById: ModelTypes["uuid"],
	cursorId: ModelTypes["bigint"],
	dateFrom: ModelTypes["date"],
	dateTo: ModelTypes["date"],
	description: string,
	facultyId: ModelTypes["uuid"],
	file: string,
	id: ModelTypes["uuid"],
	instituteId: ModelTypes["uuid"],
	name: string,
	nature: string,
	status: ModelTypes["Status_enum"],
	type: string,
	updatedAt: ModelTypes["timestamptz"],
	updatedById?: ModelTypes["uuid"] | undefined,
	venue: string
};
	/** aggregated selection of "FdpPdp" */
["FdpPdp_aggregate"]: {
		aggregate?: ModelTypes["FdpPdp_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["FdpPdp"]>
};
	/** aggregate fields of "FdpPdp" */
["FdpPdp_aggregate_fields"]: {
		avg?: ModelTypes["FdpPdp_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["FdpPdp_max_fields"] | undefined,
	min?: ModelTypes["FdpPdp_min_fields"] | undefined,
	stddev?: ModelTypes["FdpPdp_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["FdpPdp_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["FdpPdp_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["FdpPdp_sum_fields"] | undefined,
	var_pop?: ModelTypes["FdpPdp_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["FdpPdp_var_samp_fields"] | undefined,
	variance?: ModelTypes["FdpPdp_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["FdpPdp_avg_fields"]: {
		cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "FdpPdp". All fields are combined with a logical 'AND'. */
["FdpPdp_bool_exp"]: {
	_and?: Array<ModelTypes["FdpPdp_bool_exp"]> | undefined,
	_not?: ModelTypes["FdpPdp_bool_exp"] | undefined,
	_or?: Array<ModelTypes["FdpPdp_bool_exp"]> | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursorId?: ModelTypes["bigint_comparison_exp"] | undefined,
	dateFrom?: ModelTypes["date_comparison_exp"] | undefined,
	dateTo?: ModelTypes["date_comparison_exp"] | undefined,
	description?: ModelTypes["String_comparison_exp"] | undefined,
	facultyId?: ModelTypes["uuid_comparison_exp"] | undefined,
	file?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	instituteId?: ModelTypes["uuid_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	nature?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["Status_enum_comparison_exp"] | undefined,
	type?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined,
	venue?: ModelTypes["String_comparison_exp"] | undefined
};
	["FdpPdp_constraint"]:FdpPdp_constraint;
	/** input type for incrementing numeric columns in table "FdpPdp" */
["FdpPdp_inc_input"]: {
	cursorId?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "FdpPdp" */
["FdpPdp_insert_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateFrom?: ModelTypes["date"] | undefined,
	dateTo?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	facultyId?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate max on columns */
["FdpPdp_max_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateFrom?: ModelTypes["date"] | undefined,
	dateTo?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	facultyId?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate min on columns */
["FdpPdp_min_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateFrom?: ModelTypes["date"] | undefined,
	dateTo?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	facultyId?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
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
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	dateFrom?: ModelTypes["order_by"] | undefined,
	dateTo?: ModelTypes["order_by"] | undefined,
	description?: ModelTypes["order_by"] | undefined,
	facultyId?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	instituteId?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	nature?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined,
	venue?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: FdpPdp */
["FdpPdp_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["FdpPdp_select_column"]:FdpPdp_select_column;
	/** input type for updating data in table "FdpPdp" */
["FdpPdp_set_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateFrom?: ModelTypes["date"] | undefined,
	dateTo?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	facultyId?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate stddev on columns */
["FdpPdp_stddev_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["FdpPdp_stddev_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["FdpPdp_stddev_samp_fields"]: {
		cursorId?: number | undefined
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
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateFrom?: ModelTypes["date"] | undefined,
	dateTo?: ModelTypes["date"] | undefined,
	description?: string | undefined,
	facultyId?: ModelTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate sum on columns */
["FdpPdp_sum_fields"]: {
		cursorId?: ModelTypes["bigint"] | undefined
};
	["FdpPdp_update_column"]:FdpPdp_update_column;
	["FdpPdp_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["FdpPdp_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["FdpPdp_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["FdpPdp_bool_exp"]
};
	/** aggregate var_pop on columns */
["FdpPdp_var_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["FdpPdp_var_samp_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate variance on columns */
["FdpPdp_variance_fields"]: {
		cursorId?: number | undefined
};
	/** columns and relationships of "Genesis" */
["Genesis"]: {
		createdAt: ModelTypes["timestamp"],
	emailId: string,
	id: ModelTypes["uuid"],
	isVerified: boolean,
	name: string,
	phoneNo: string,
	role: string,
	updatedAt: ModelTypes["timestamp"]
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
	createdAt?: ModelTypes["timestamp_comparison_exp"] | undefined,
	emailId?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	isVerified?: ModelTypes["Boolean_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	phoneNo?: ModelTypes["String_comparison_exp"] | undefined,
	role?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamp_comparison_exp"] | undefined
};
	["Genesis_constraint"]:Genesis_constraint;
	/** input type for inserting data into table "Genesis" */
["Genesis_insert_input"]: {
	createdAt?: ModelTypes["timestamp"] | undefined,
	emailId?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	role?: string | undefined,
	updatedAt?: ModelTypes["timestamp"] | undefined
};
	/** aggregate max on columns */
["Genesis_max_fields"]: {
		createdAt?: ModelTypes["timestamp"] | undefined,
	emailId?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	role?: string | undefined,
	updatedAt?: ModelTypes["timestamp"] | undefined
};
	/** aggregate min on columns */
["Genesis_min_fields"]: {
		createdAt?: ModelTypes["timestamp"] | undefined,
	emailId?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	role?: string | undefined,
	updatedAt?: ModelTypes["timestamp"] | undefined
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
	createdAt?: ModelTypes["order_by"] | undefined,
	emailId?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	isVerified?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	phoneNo?: ModelTypes["order_by"] | undefined,
	role?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: Genesis */
["Genesis_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["Genesis_select_column"]:Genesis_select_column;
	/** input type for updating data in table "Genesis" */
["Genesis_set_input"]: {
	createdAt?: ModelTypes["timestamp"] | undefined,
	emailId?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	role?: string | undefined,
	updatedAt?: ModelTypes["timestamp"] | undefined
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
	createdAt?: ModelTypes["timestamp"] | undefined,
	emailId?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	role?: string | undefined,
	updatedAt?: ModelTypes["timestamp"] | undefined
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
	createdAt: ModelTypes["timestamptz"],
	createdById: ModelTypes["uuid"],
	cursorId: ModelTypes["bigint"],
	dateOfEstablishment: ModelTypes["date"],
	id: ModelTypes["uuid"],
	isVerified: boolean,
	landmark: string,
	name: string,
	pin: string,
	state: string,
	status: ModelTypes["Status_enum"],
	type: string,
	updatedAt: ModelTypes["timestamptz"],
	updatedById?: ModelTypes["uuid"] | undefined,
	website: string
};
	/** columns and relationships of "InstituteFunding" */
["InstituteFunding"]: {
		amount: string,
	createdAt: ModelTypes["timestamptz"],
	createdById: ModelTypes["uuid"],
	cursorId: ModelTypes["bigint"],
	id: ModelTypes["uuid"],
	instituteId: ModelTypes["uuid"],
	name: string,
	purpose: string,
	status: ModelTypes["Status_enum"],
	transactionDate: ModelTypes["date"],
	transactionType: string,
	type: string,
	updatedAt: ModelTypes["timestamptz"],
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregated selection of "InstituteFunding" */
["InstituteFunding_aggregate"]: {
		aggregate?: ModelTypes["InstituteFunding_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["InstituteFunding"]>
};
	/** aggregate fields of "InstituteFunding" */
["InstituteFunding_aggregate_fields"]: {
		avg?: ModelTypes["InstituteFunding_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["InstituteFunding_max_fields"] | undefined,
	min?: ModelTypes["InstituteFunding_min_fields"] | undefined,
	stddev?: ModelTypes["InstituteFunding_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["InstituteFunding_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["InstituteFunding_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["InstituteFunding_sum_fields"] | undefined,
	var_pop?: ModelTypes["InstituteFunding_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["InstituteFunding_var_samp_fields"] | undefined,
	variance?: ModelTypes["InstituteFunding_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["InstituteFunding_avg_fields"]: {
		cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "InstituteFunding". All fields are combined with a logical 'AND'. */
["InstituteFunding_bool_exp"]: {
	_and?: Array<ModelTypes["InstituteFunding_bool_exp"]> | undefined,
	_not?: ModelTypes["InstituteFunding_bool_exp"] | undefined,
	_or?: Array<ModelTypes["InstituteFunding_bool_exp"]> | undefined,
	amount?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursorId?: ModelTypes["bigint_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	instituteId?: ModelTypes["uuid_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	purpose?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["Status_enum_comparison_exp"] | undefined,
	transactionDate?: ModelTypes["date_comparison_exp"] | undefined,
	transactionType?: ModelTypes["String_comparison_exp"] | undefined,
	type?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["InstituteFunding_constraint"]:InstituteFunding_constraint;
	/** input type for incrementing numeric columns in table "InstituteFunding" */
["InstituteFunding_inc_input"]: {
	cursorId?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "InstituteFunding" */
["InstituteFunding_insert_input"]: {
	amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	transactionDate?: ModelTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["InstituteFunding_max_fields"]: {
		amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	transactionDate?: ModelTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate min on columns */
["InstituteFunding_min_fields"]: {
		amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	transactionDate?: ModelTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
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
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	instituteId?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	purpose?: ModelTypes["order_by"] | undefined,
	status?: ModelTypes["order_by"] | undefined,
	transactionDate?: ModelTypes["order_by"] | undefined,
	transactionType?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	updatedById?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: InstituteFunding */
["InstituteFunding_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["InstituteFunding_select_column"]:InstituteFunding_select_column;
	/** input type for updating data in table "InstituteFunding" */
["InstituteFunding_set_input"]: {
	amount?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	transactionDate?: ModelTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["InstituteFunding_stddev_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["InstituteFunding_stddev_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["InstituteFunding_stddev_samp_fields"]: {
		cursorId?: number | undefined
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
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	instituteId?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	transactionDate?: ModelTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["InstituteFunding_sum_fields"]: {
		cursorId?: ModelTypes["bigint"] | undefined
};
	["InstituteFunding_update_column"]:InstituteFunding_update_column;
	["InstituteFunding_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["InstituteFunding_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["InstituteFunding_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["InstituteFunding_bool_exp"]
};
	/** aggregate var_pop on columns */
["InstituteFunding_var_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["InstituteFunding_var_samp_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate variance on columns */
["InstituteFunding_variance_fields"]: {
		cursorId?: number | undefined
};
	/** aggregated selection of "Institute" */
["Institute_aggregate"]: {
		aggregate?: ModelTypes["Institute_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["Institute"]>
};
	/** aggregate fields of "Institute" */
["Institute_aggregate_fields"]: {
		avg?: ModelTypes["Institute_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["Institute_max_fields"] | undefined,
	min?: ModelTypes["Institute_min_fields"] | undefined,
	stddev?: ModelTypes["Institute_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["Institute_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["Institute_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["Institute_sum_fields"] | undefined,
	var_pop?: ModelTypes["Institute_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["Institute_var_samp_fields"] | undefined,
	variance?: ModelTypes["Institute_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["Institute_avg_fields"]: {
		cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "Institute". All fields are combined with a logical 'AND'. */
["Institute_bool_exp"]: {
	_and?: Array<ModelTypes["Institute_bool_exp"]> | undefined,
	_not?: ModelTypes["Institute_bool_exp"] | undefined,
	_or?: Array<ModelTypes["Institute_bool_exp"]> | undefined,
	address?: ModelTypes["String_comparison_exp"] | undefined,
	city?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: ModelTypes["uuid_comparison_exp"] | undefined,
	cursorId?: ModelTypes["bigint_comparison_exp"] | undefined,
	dateOfEstablishment?: ModelTypes["date_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	isVerified?: ModelTypes["Boolean_comparison_exp"] | undefined,
	landmark?: ModelTypes["String_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	pin?: ModelTypes["String_comparison_exp"] | undefined,
	state?: ModelTypes["String_comparison_exp"] | undefined,
	status?: ModelTypes["Status_enum_comparison_exp"] | undefined,
	type?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: ModelTypes["uuid_comparison_exp"] | undefined,
	website?: ModelTypes["String_comparison_exp"] | undefined
};
	["Institute_constraint"]:Institute_constraint;
	/** input type for incrementing numeric columns in table "Institute" */
["Institute_inc_input"]: {
	cursorId?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "Institute" */
["Institute_insert_input"]: {
	address?: string | undefined,
	city?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateOfEstablishment?: ModelTypes["date"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate max on columns */
["Institute_max_fields"]: {
		address?: string | undefined,
	city?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateOfEstablishment?: ModelTypes["date"] | undefined,
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
["Institute_min_fields"]: {
		address?: string | undefined,
	city?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateOfEstablishment?: ModelTypes["date"] | undefined,
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
	createdAt?: ModelTypes["order_by"] | undefined,
	createdById?: ModelTypes["order_by"] | undefined,
	cursorId?: ModelTypes["order_by"] | undefined,
	dateOfEstablishment?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	isVerified?: ModelTypes["order_by"] | undefined,
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
	/** primary key columns input for table: Institute */
["Institute_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["Institute_select_column"]:Institute_select_column;
	/** input type for updating data in table "Institute" */
["Institute_set_input"]: {
	address?: string | undefined,
	city?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateOfEstablishment?: ModelTypes["date"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate stddev on columns */
["Institute_stddev_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["Institute_stddev_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["Institute_stddev_samp_fields"]: {
		cursorId?: number | undefined
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
	createdAt?: ModelTypes["timestamptz"] | undefined,
	createdById?: ModelTypes["uuid"] | undefined,
	cursorId?: ModelTypes["bigint"] | undefined,
	dateOfEstablishment?: ModelTypes["date"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	status?: ModelTypes["Status_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	updatedById?: ModelTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate sum on columns */
["Institute_sum_fields"]: {
		cursorId?: ModelTypes["bigint"] | undefined
};
	["Institute_update_column"]:Institute_update_column;
	["Institute_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["Institute_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["Institute_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["Institute_bool_exp"]
};
	/** aggregate var_pop on columns */
["Institute_var_pop_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["Institute_var_samp_fields"]: {
		cursorId?: number | undefined
};
	/** aggregate variance on columns */
["Institute_variance_fields"]: {
		cursorId?: number | undefined
};
	/** columns and relationships of "Status" */
["Status"]: {
		value: string
};
	/** aggregated selection of "Status" */
["Status_aggregate"]: {
		aggregate?: ModelTypes["Status_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["Status"]>
};
	/** aggregate fields of "Status" */
["Status_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["Status_max_fields"] | undefined,
	min?: ModelTypes["Status_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "Status". All fields are combined with a logical 'AND'. */
["Status_bool_exp"]: {
	_and?: Array<ModelTypes["Status_bool_exp"]> | undefined,
	_not?: ModelTypes["Status_bool_exp"] | undefined,
	_or?: Array<ModelTypes["Status_bool_exp"]> | undefined,
	value?: ModelTypes["String_comparison_exp"] | undefined
};
	["Status_constraint"]:Status_constraint;
	["Status_enum"]:Status_enum;
	/** Boolean expression to compare columns of type "Status_enum". All fields are combined with logical 'AND'. */
["Status_enum_comparison_exp"]: {
	_eq?: ModelTypes["Status_enum"] | undefined,
	_in?: Array<ModelTypes["Status_enum"]> | undefined,
	_is_null?: boolean | undefined,
	_neq?: ModelTypes["Status_enum"] | undefined,
	_nin?: Array<ModelTypes["Status_enum"]> | undefined
};
	/** input type for inserting data into table "Status" */
["Status_insert_input"]: {
	value?: string | undefined
};
	/** aggregate max on columns */
["Status_max_fields"]: {
		value?: string | undefined
};
	/** aggregate min on columns */
["Status_min_fields"]: {
		value?: string | undefined
};
	/** response of any mutation on the table "Status" */
["Status_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["Status"]>
};
	/** on_conflict condition type for table "Status" */
["Status_on_conflict"]: {
	constraint: ModelTypes["Status_constraint"],
	update_columns: Array<ModelTypes["Status_update_column"]>,
	where?: ModelTypes["Status_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "Status". */
["Status_order_by"]: {
	value?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: Status */
["Status_pk_columns_input"]: {
	value: string
};
	["Status_select_column"]:Status_select_column;
	/** input type for updating data in table "Status" */
["Status_set_input"]: {
	value?: string | undefined
};
	/** Streaming cursor of the table "Status" */
["Status_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["Status_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["Status_stream_cursor_value_input"]: {
	value?: string | undefined
};
	["Status_update_column"]:Status_update_column;
	["Status_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["Status_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["Status_bool_exp"]
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
	/** delete data from the table: "Status" */
	delete_Status?: ModelTypes["Status_mutation_response"] | undefined,
	/** delete single row from the table: "Status" */
	delete_Status_by_pk?: ModelTypes["Status"] | undefined,
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
	/** insert data into the table: "Status" */
	insert_Status?: ModelTypes["Status_mutation_response"] | undefined,
	/** insert a single row into the table: "Status" */
	insert_Status_one?: ModelTypes["Status"] | undefined,
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
	update_Institute_many?: Array<ModelTypes["Institute_mutation_response"] | undefined> | undefined,
	/** update data of the table: "Status" */
	update_Status?: ModelTypes["Status_mutation_response"] | undefined,
	/** update single row of the table: "Status" */
	update_Status_by_pk?: ModelTypes["Status"] | undefined,
	/** update multiples rows of table: "Status" */
	update_Status_many?: Array<ModelTypes["Status_mutation_response"] | undefined> | undefined
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
	Institute_by_pk?: ModelTypes["Institute"] | undefined,
	/** fetch data from the table: "Status" */
	Status: Array<ModelTypes["Status"]>,
	/** fetch aggregated fields from the table: "Status" */
	Status_aggregate: ModelTypes["Status_aggregate"],
	/** fetch data from the table: "Status" using primary key columns */
	Status_by_pk?: ModelTypes["Status"] | undefined
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
	Institute_stream: Array<ModelTypes["Institute"]>,
	/** fetch data from the table: "Status" */
	Status: Array<ModelTypes["Status"]>,
	/** fetch aggregated fields from the table: "Status" */
	Status_aggregate: ModelTypes["Status_aggregate"],
	/** fetch data from the table: "Status" using primary key columns */
	Status_by_pk?: ModelTypes["Status"] | undefined,
	/** fetch data from the table in a streaming manner: "Status" */
	Status_stream: Array<ModelTypes["Status"]>
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
	createdAt: GraphQLTypes["timestamptz"],
	createdById: GraphQLTypes["uuid"],
	cursorId: GraphQLTypes["bigint"],
	description: string,
	file: string,
	id: GraphQLTypes["uuid"],
	instituteId: GraphQLTypes["uuid"],
	name: string,
	phoneNo: string,
	serviceEndDate: GraphQLTypes["date"],
	serviceStartDate: GraphQLTypes["date"],
	status: GraphQLTypes["Status_enum"],
	totalAmount: string,
	updatedAt: GraphQLTypes["timestamptz"],
	updatedById?: GraphQLTypes["uuid"] | undefined,
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
	avg?: GraphQLTypes["EGovernance_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["EGovernance_max_fields"] | undefined,
	min?: GraphQLTypes["EGovernance_min_fields"] | undefined,
	stddev?: GraphQLTypes["EGovernance_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["EGovernance_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["EGovernance_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["EGovernance_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["EGovernance_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["EGovernance_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["EGovernance_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["EGovernance_avg_fields"]: {
	__typename: "EGovernance_avg_fields",
	cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "EGovernance". All fields are combined with a logical 'AND'. */
["EGovernance_bool_exp"]: {
		_and?: Array<GraphQLTypes["EGovernance_bool_exp"]> | undefined,
	_not?: GraphQLTypes["EGovernance_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["EGovernance_bool_exp"]> | undefined,
	address?: GraphQLTypes["String_comparison_exp"] | undefined,
	area?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	description?: GraphQLTypes["String_comparison_exp"] | undefined,
	file?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	instituteId?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	phoneNo?: GraphQLTypes["String_comparison_exp"] | undefined,
	serviceEndDate?: GraphQLTypes["date_comparison_exp"] | undefined,
	serviceStartDate?: GraphQLTypes["date_comparison_exp"] | undefined,
	status?: GraphQLTypes["Status_enum_comparison_exp"] | undefined,
	totalAmount?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	website?: GraphQLTypes["String_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "EGovernance" */
["EGovernance_constraint"]: EGovernance_constraint;
	/** input type for incrementing numeric columns in table "EGovernance" */
["EGovernance_inc_input"]: {
		cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "EGovernance" */
["EGovernance_insert_input"]: {
		address?: string | undefined,
	area?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	serviceEndDate?: GraphQLTypes["date"] | undefined,
	serviceStartDate?: GraphQLTypes["date"] | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	totalAmount?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate max on columns */
["EGovernance_max_fields"]: {
	__typename: "EGovernance_max_fields",
	address?: string | undefined,
	area?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	serviceEndDate?: GraphQLTypes["date"] | undefined,
	serviceStartDate?: GraphQLTypes["date"] | undefined,
	totalAmount?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate min on columns */
["EGovernance_min_fields"]: {
	__typename: "EGovernance_min_fields",
	address?: string | undefined,
	area?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	serviceEndDate?: GraphQLTypes["date"] | undefined,
	serviceStartDate?: GraphQLTypes["date"] | undefined,
	totalAmount?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
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
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	description?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	instituteId?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	phoneNo?: GraphQLTypes["order_by"] | undefined,
	serviceEndDate?: GraphQLTypes["order_by"] | undefined,
	serviceStartDate?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	totalAmount?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
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
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	serviceEndDate?: GraphQLTypes["date"] | undefined,
	serviceStartDate?: GraphQLTypes["date"] | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	totalAmount?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate stddev on columns */
["EGovernance_stddev_fields"]: {
	__typename: "EGovernance_stddev_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["EGovernance_stddev_pop_fields"]: {
	__typename: "EGovernance_stddev_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["EGovernance_stddev_samp_fields"]: {
	__typename: "EGovernance_stddev_samp_fields",
	cursorId?: number | undefined
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
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	description?: string | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	serviceEndDate?: GraphQLTypes["date"] | undefined,
	serviceStartDate?: GraphQLTypes["date"] | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	totalAmount?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate sum on columns */
["EGovernance_sum_fields"]: {
	__typename: "EGovernance_sum_fields",
	cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** update columns of table "EGovernance" */
["EGovernance_update_column"]: EGovernance_update_column;
	["EGovernance_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["EGovernance_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["EGovernance_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["EGovernance_bool_exp"]
};
	/** aggregate var_pop on columns */
["EGovernance_var_pop_fields"]: {
	__typename: "EGovernance_var_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["EGovernance_var_samp_fields"]: {
	__typename: "EGovernance_var_samp_fields",
	cursorId?: number | undefined
};
	/** aggregate variance on columns */
["EGovernance_variance_fields"]: {
	__typename: "EGovernance_variance_fields",
	cursorId?: number | undefined
};
	/** columns and relationships of "Faculty" */
["Faculty"]: {
	__typename: "Faculty",
	address: string,
	cast: string,
	createdAt: GraphQLTypes["timestamptz"],
	createdById: GraphQLTypes["uuid"],
	cursorId: GraphQLTypes["bigint"],
	dateOfJoining: GraphQLTypes["date"],
	designation: string,
	dob: GraphQLTypes["date"],
	emailId: string,
	experience: string,
	gender: string,
	id: GraphQLTypes["uuid"],
	instituteId: GraphQLTypes["uuid"],
	isVerified: boolean,
	jobType: string,
	minority: string,
	name: string,
	panCardNo: string,
	phoneNo: string,
	qualification: string,
	section: string,
	staffType: string,
	status: GraphQLTypes["Status_enum"],
	statusOfApproval: string,
	updatedAt: GraphQLTypes["timestamptz"],
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** columns and relationships of "FacultyFunding" */
["FacultyFunding"]: {
	__typename: "FacultyFunding",
	amount: string,
	createdAt: GraphQLTypes["timestamptz"],
	createdById: GraphQLTypes["uuid"],
	cursorId: GraphQLTypes["bigint"],
	facultyId: GraphQLTypes["uuid"],
	file: string,
	id: GraphQLTypes["uuid"],
	instituteId: GraphQLTypes["uuid"],
	nature: string,
	status: GraphQLTypes["Status_enum"],
	transactionDate: GraphQLTypes["date"],
	transactionType: string,
	type: string,
	updatedAt: GraphQLTypes["timestamptz"],
	updatedById?: GraphQLTypes["uuid"] | undefined
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
	avg?: GraphQLTypes["FacultyFunding_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["FacultyFunding_max_fields"] | undefined,
	min?: GraphQLTypes["FacultyFunding_min_fields"] | undefined,
	stddev?: GraphQLTypes["FacultyFunding_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["FacultyFunding_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["FacultyFunding_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["FacultyFunding_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["FacultyFunding_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["FacultyFunding_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["FacultyFunding_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["FacultyFunding_avg_fields"]: {
	__typename: "FacultyFunding_avg_fields",
	cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "FacultyFunding". All fields are combined with a logical 'AND'. */
["FacultyFunding_bool_exp"]: {
		_and?: Array<GraphQLTypes["FacultyFunding_bool_exp"]> | undefined,
	_not?: GraphQLTypes["FacultyFunding_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["FacultyFunding_bool_exp"]> | undefined,
	amount?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	facultyId?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	file?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	instituteId?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	nature?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["Status_enum_comparison_exp"] | undefined,
	transactionDate?: GraphQLTypes["date_comparison_exp"] | undefined,
	transactionType?: GraphQLTypes["String_comparison_exp"] | undefined,
	type?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "FacultyFunding" */
["FacultyFunding_constraint"]: FacultyFunding_constraint;
	/** input type for incrementing numeric columns in table "FacultyFunding" */
["FacultyFunding_inc_input"]: {
		cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "FacultyFunding" */
["FacultyFunding_insert_input"]: {
		amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	facultyId?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	transactionDate?: GraphQLTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["FacultyFunding_max_fields"]: {
	__typename: "FacultyFunding_max_fields",
	amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	facultyId?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	transactionDate?: GraphQLTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate min on columns */
["FacultyFunding_min_fields"]: {
	__typename: "FacultyFunding_min_fields",
	amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	facultyId?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	transactionDate?: GraphQLTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
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
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	facultyId?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	instituteId?: GraphQLTypes["order_by"] | undefined,
	nature?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	transactionDate?: GraphQLTypes["order_by"] | undefined,
	transactionType?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined
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
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	facultyId?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	transactionDate?: GraphQLTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["FacultyFunding_stddev_fields"]: {
	__typename: "FacultyFunding_stddev_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["FacultyFunding_stddev_pop_fields"]: {
	__typename: "FacultyFunding_stddev_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["FacultyFunding_stddev_samp_fields"]: {
	__typename: "FacultyFunding_stddev_samp_fields",
	cursorId?: number | undefined
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
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	facultyId?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	nature?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	transactionDate?: GraphQLTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["FacultyFunding_sum_fields"]: {
	__typename: "FacultyFunding_sum_fields",
	cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** update columns of table "FacultyFunding" */
["FacultyFunding_update_column"]: FacultyFunding_update_column;
	["FacultyFunding_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["FacultyFunding_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["FacultyFunding_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["FacultyFunding_bool_exp"]
};
	/** aggregate var_pop on columns */
["FacultyFunding_var_pop_fields"]: {
	__typename: "FacultyFunding_var_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["FacultyFunding_var_samp_fields"]: {
	__typename: "FacultyFunding_var_samp_fields",
	cursorId?: number | undefined
};
	/** aggregate variance on columns */
["FacultyFunding_variance_fields"]: {
	__typename: "FacultyFunding_variance_fields",
	cursorId?: number | undefined
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
	avg?: GraphQLTypes["Faculty_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["Faculty_max_fields"] | undefined,
	min?: GraphQLTypes["Faculty_min_fields"] | undefined,
	stddev?: GraphQLTypes["Faculty_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["Faculty_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["Faculty_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["Faculty_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["Faculty_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["Faculty_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["Faculty_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["Faculty_avg_fields"]: {
	__typename: "Faculty_avg_fields",
	cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "Faculty". All fields are combined with a logical 'AND'. */
["Faculty_bool_exp"]: {
		_and?: Array<GraphQLTypes["Faculty_bool_exp"]> | undefined,
	_not?: GraphQLTypes["Faculty_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["Faculty_bool_exp"]> | undefined,
	address?: GraphQLTypes["String_comparison_exp"] | undefined,
	cast?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	dateOfJoining?: GraphQLTypes["date_comparison_exp"] | undefined,
	designation?: GraphQLTypes["String_comparison_exp"] | undefined,
	dob?: GraphQLTypes["date_comparison_exp"] | undefined,
	emailId?: GraphQLTypes["String_comparison_exp"] | undefined,
	experience?: GraphQLTypes["String_comparison_exp"] | undefined,
	gender?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	instituteId?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	isVerified?: GraphQLTypes["Boolean_comparison_exp"] | undefined,
	jobType?: GraphQLTypes["String_comparison_exp"] | undefined,
	minority?: GraphQLTypes["String_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	panCardNo?: GraphQLTypes["String_comparison_exp"] | undefined,
	phoneNo?: GraphQLTypes["String_comparison_exp"] | undefined,
	qualification?: GraphQLTypes["String_comparison_exp"] | undefined,
	section?: GraphQLTypes["String_comparison_exp"] | undefined,
	staffType?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["Status_enum_comparison_exp"] | undefined,
	statusOfApproval?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "Faculty" */
["Faculty_constraint"]: Faculty_constraint;
	/** input type for incrementing numeric columns in table "Faculty" */
["Faculty_inc_input"]: {
		cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "Faculty" */
["Faculty_insert_input"]: {
		address?: string | undefined,
	cast?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateOfJoining?: GraphQLTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: GraphQLTypes["date"] | undefined,
	emailId?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	jobType?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	panCardNo?: string | undefined,
	phoneNo?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staffType?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	statusOfApproval?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["Faculty_max_fields"]: {
	__typename: "Faculty_max_fields",
	address?: string | undefined,
	cast?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateOfJoining?: GraphQLTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: GraphQLTypes["date"] | undefined,
	emailId?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	jobType?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	panCardNo?: string | undefined,
	phoneNo?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staffType?: string | undefined,
	statusOfApproval?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate min on columns */
["Faculty_min_fields"]: {
	__typename: "Faculty_min_fields",
	address?: string | undefined,
	cast?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateOfJoining?: GraphQLTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: GraphQLTypes["date"] | undefined,
	emailId?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	jobType?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	panCardNo?: string | undefined,
	phoneNo?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staffType?: string | undefined,
	statusOfApproval?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
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
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	dateOfJoining?: GraphQLTypes["order_by"] | undefined,
	designation?: GraphQLTypes["order_by"] | undefined,
	dob?: GraphQLTypes["order_by"] | undefined,
	emailId?: GraphQLTypes["order_by"] | undefined,
	experience?: GraphQLTypes["order_by"] | undefined,
	gender?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	instituteId?: GraphQLTypes["order_by"] | undefined,
	isVerified?: GraphQLTypes["order_by"] | undefined,
	jobType?: GraphQLTypes["order_by"] | undefined,
	minority?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	panCardNo?: GraphQLTypes["order_by"] | undefined,
	phoneNo?: GraphQLTypes["order_by"] | undefined,
	qualification?: GraphQLTypes["order_by"] | undefined,
	section?: GraphQLTypes["order_by"] | undefined,
	staffType?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	statusOfApproval?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined
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
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateOfJoining?: GraphQLTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: GraphQLTypes["date"] | undefined,
	emailId?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	jobType?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	panCardNo?: string | undefined,
	phoneNo?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staffType?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	statusOfApproval?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["Faculty_stddev_fields"]: {
	__typename: "Faculty_stddev_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["Faculty_stddev_pop_fields"]: {
	__typename: "Faculty_stddev_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["Faculty_stddev_samp_fields"]: {
	__typename: "Faculty_stddev_samp_fields",
	cursorId?: number | undefined
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
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateOfJoining?: GraphQLTypes["date"] | undefined,
	designation?: string | undefined,
	dob?: GraphQLTypes["date"] | undefined,
	emailId?: string | undefined,
	experience?: string | undefined,
	gender?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	jobType?: string | undefined,
	minority?: string | undefined,
	name?: string | undefined,
	panCardNo?: string | undefined,
	phoneNo?: string | undefined,
	qualification?: string | undefined,
	section?: string | undefined,
	staffType?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	statusOfApproval?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["Faculty_sum_fields"]: {
	__typename: "Faculty_sum_fields",
	cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** update columns of table "Faculty" */
["Faculty_update_column"]: Faculty_update_column;
	["Faculty_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["Faculty_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["Faculty_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["Faculty_bool_exp"]
};
	/** aggregate var_pop on columns */
["Faculty_var_pop_fields"]: {
	__typename: "Faculty_var_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["Faculty_var_samp_fields"]: {
	__typename: "Faculty_var_samp_fields",
	cursorId?: number | undefined
};
	/** aggregate variance on columns */
["Faculty_variance_fields"]: {
	__typename: "Faculty_variance_fields",
	cursorId?: number | undefined
};
	/** columns and relationships of "FdpPdp" */
["FdpPdp"]: {
	__typename: "FdpPdp",
	createdAt: GraphQLTypes["timestamptz"],
	createdById: GraphQLTypes["uuid"],
	cursorId: GraphQLTypes["bigint"],
	dateFrom: GraphQLTypes["date"],
	dateTo: GraphQLTypes["date"],
	description: string,
	facultyId: GraphQLTypes["uuid"],
	file: string,
	id: GraphQLTypes["uuid"],
	instituteId: GraphQLTypes["uuid"],
	name: string,
	nature: string,
	status: GraphQLTypes["Status_enum"],
	type: string,
	updatedAt: GraphQLTypes["timestamptz"],
	updatedById?: GraphQLTypes["uuid"] | undefined,
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
	avg?: GraphQLTypes["FdpPdp_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["FdpPdp_max_fields"] | undefined,
	min?: GraphQLTypes["FdpPdp_min_fields"] | undefined,
	stddev?: GraphQLTypes["FdpPdp_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["FdpPdp_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["FdpPdp_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["FdpPdp_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["FdpPdp_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["FdpPdp_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["FdpPdp_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["FdpPdp_avg_fields"]: {
	__typename: "FdpPdp_avg_fields",
	cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "FdpPdp". All fields are combined with a logical 'AND'. */
["FdpPdp_bool_exp"]: {
		_and?: Array<GraphQLTypes["FdpPdp_bool_exp"]> | undefined,
	_not?: GraphQLTypes["FdpPdp_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["FdpPdp_bool_exp"]> | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	dateFrom?: GraphQLTypes["date_comparison_exp"] | undefined,
	dateTo?: GraphQLTypes["date_comparison_exp"] | undefined,
	description?: GraphQLTypes["String_comparison_exp"] | undefined,
	facultyId?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	file?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	instituteId?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	nature?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["Status_enum_comparison_exp"] | undefined,
	type?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	venue?: GraphQLTypes["String_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "FdpPdp" */
["FdpPdp_constraint"]: FdpPdp_constraint;
	/** input type for incrementing numeric columns in table "FdpPdp" */
["FdpPdp_inc_input"]: {
		cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "FdpPdp" */
["FdpPdp_insert_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateFrom?: GraphQLTypes["date"] | undefined,
	dateTo?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	facultyId?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate max on columns */
["FdpPdp_max_fields"]: {
	__typename: "FdpPdp_max_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateFrom?: GraphQLTypes["date"] | undefined,
	dateTo?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	facultyId?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate min on columns */
["FdpPdp_min_fields"]: {
	__typename: "FdpPdp_min_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateFrom?: GraphQLTypes["date"] | undefined,
	dateTo?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	facultyId?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
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
		createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	dateFrom?: GraphQLTypes["order_by"] | undefined,
	dateTo?: GraphQLTypes["order_by"] | undefined,
	description?: GraphQLTypes["order_by"] | undefined,
	facultyId?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	instituteId?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	nature?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined,
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
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateFrom?: GraphQLTypes["date"] | undefined,
	dateTo?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	facultyId?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate stddev on columns */
["FdpPdp_stddev_fields"]: {
	__typename: "FdpPdp_stddev_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["FdpPdp_stddev_pop_fields"]: {
	__typename: "FdpPdp_stddev_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["FdpPdp_stddev_samp_fields"]: {
	__typename: "FdpPdp_stddev_samp_fields",
	cursorId?: number | undefined
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
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateFrom?: GraphQLTypes["date"] | undefined,
	dateTo?: GraphQLTypes["date"] | undefined,
	description?: string | undefined,
	facultyId?: GraphQLTypes["uuid"] | undefined,
	file?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	nature?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	venue?: string | undefined
};
	/** aggregate sum on columns */
["FdpPdp_sum_fields"]: {
	__typename: "FdpPdp_sum_fields",
	cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** update columns of table "FdpPdp" */
["FdpPdp_update_column"]: FdpPdp_update_column;
	["FdpPdp_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["FdpPdp_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["FdpPdp_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["FdpPdp_bool_exp"]
};
	/** aggregate var_pop on columns */
["FdpPdp_var_pop_fields"]: {
	__typename: "FdpPdp_var_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["FdpPdp_var_samp_fields"]: {
	__typename: "FdpPdp_var_samp_fields",
	cursorId?: number | undefined
};
	/** aggregate variance on columns */
["FdpPdp_variance_fields"]: {
	__typename: "FdpPdp_variance_fields",
	cursorId?: number | undefined
};
	/** columns and relationships of "Genesis" */
["Genesis"]: {
	__typename: "Genesis",
	createdAt: GraphQLTypes["timestamp"],
	emailId: string,
	id: GraphQLTypes["uuid"],
	isVerified: boolean,
	name: string,
	phoneNo: string,
	role: string,
	updatedAt: GraphQLTypes["timestamp"]
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
	createdAt?: GraphQLTypes["timestamp_comparison_exp"] | undefined,
	emailId?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	isVerified?: GraphQLTypes["Boolean_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	phoneNo?: GraphQLTypes["String_comparison_exp"] | undefined,
	role?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamp_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "Genesis" */
["Genesis_constraint"]: Genesis_constraint;
	/** input type for inserting data into table "Genesis" */
["Genesis_insert_input"]: {
		createdAt?: GraphQLTypes["timestamp"] | undefined,
	emailId?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	role?: string | undefined,
	updatedAt?: GraphQLTypes["timestamp"] | undefined
};
	/** aggregate max on columns */
["Genesis_max_fields"]: {
	__typename: "Genesis_max_fields",
	createdAt?: GraphQLTypes["timestamp"] | undefined,
	emailId?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	role?: string | undefined,
	updatedAt?: GraphQLTypes["timestamp"] | undefined
};
	/** aggregate min on columns */
["Genesis_min_fields"]: {
	__typename: "Genesis_min_fields",
	createdAt?: GraphQLTypes["timestamp"] | undefined,
	emailId?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	role?: string | undefined,
	updatedAt?: GraphQLTypes["timestamp"] | undefined
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
		createdAt?: GraphQLTypes["order_by"] | undefined,
	emailId?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	isVerified?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	phoneNo?: GraphQLTypes["order_by"] | undefined,
	role?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: Genesis */
["Genesis_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "Genesis" */
["Genesis_select_column"]: Genesis_select_column;
	/** input type for updating data in table "Genesis" */
["Genesis_set_input"]: {
		createdAt?: GraphQLTypes["timestamp"] | undefined,
	emailId?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	role?: string | undefined,
	updatedAt?: GraphQLTypes["timestamp"] | undefined
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
		createdAt?: GraphQLTypes["timestamp"] | undefined,
	emailId?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	name?: string | undefined,
	phoneNo?: string | undefined,
	role?: string | undefined,
	updatedAt?: GraphQLTypes["timestamp"] | undefined
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
	createdAt: GraphQLTypes["timestamptz"],
	createdById: GraphQLTypes["uuid"],
	cursorId: GraphQLTypes["bigint"],
	dateOfEstablishment: GraphQLTypes["date"],
	id: GraphQLTypes["uuid"],
	isVerified: boolean,
	landmark: string,
	name: string,
	pin: string,
	state: string,
	status: GraphQLTypes["Status_enum"],
	type: string,
	updatedAt: GraphQLTypes["timestamptz"],
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website: string
};
	/** columns and relationships of "InstituteFunding" */
["InstituteFunding"]: {
	__typename: "InstituteFunding",
	amount: string,
	createdAt: GraphQLTypes["timestamptz"],
	createdById: GraphQLTypes["uuid"],
	cursorId: GraphQLTypes["bigint"],
	id: GraphQLTypes["uuid"],
	instituteId: GraphQLTypes["uuid"],
	name: string,
	purpose: string,
	status: GraphQLTypes["Status_enum"],
	transactionDate: GraphQLTypes["date"],
	transactionType: string,
	type: string,
	updatedAt: GraphQLTypes["timestamptz"],
	updatedById?: GraphQLTypes["uuid"] | undefined
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
	avg?: GraphQLTypes["InstituteFunding_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["InstituteFunding_max_fields"] | undefined,
	min?: GraphQLTypes["InstituteFunding_min_fields"] | undefined,
	stddev?: GraphQLTypes["InstituteFunding_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["InstituteFunding_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["InstituteFunding_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["InstituteFunding_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["InstituteFunding_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["InstituteFunding_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["InstituteFunding_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["InstituteFunding_avg_fields"]: {
	__typename: "InstituteFunding_avg_fields",
	cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "InstituteFunding". All fields are combined with a logical 'AND'. */
["InstituteFunding_bool_exp"]: {
		_and?: Array<GraphQLTypes["InstituteFunding_bool_exp"]> | undefined,
	_not?: GraphQLTypes["InstituteFunding_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["InstituteFunding_bool_exp"]> | undefined,
	amount?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	instituteId?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	purpose?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["Status_enum_comparison_exp"] | undefined,
	transactionDate?: GraphQLTypes["date_comparison_exp"] | undefined,
	transactionType?: GraphQLTypes["String_comparison_exp"] | undefined,
	type?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "InstituteFunding" */
["InstituteFunding_constraint"]: InstituteFunding_constraint;
	/** input type for incrementing numeric columns in table "InstituteFunding" */
["InstituteFunding_inc_input"]: {
		cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "InstituteFunding" */
["InstituteFunding_insert_input"]: {
		amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	transactionDate?: GraphQLTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["InstituteFunding_max_fields"]: {
	__typename: "InstituteFunding_max_fields",
	amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	transactionDate?: GraphQLTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate min on columns */
["InstituteFunding_min_fields"]: {
	__typename: "InstituteFunding_min_fields",
	amount?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	transactionDate?: GraphQLTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
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
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	instituteId?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	purpose?: GraphQLTypes["order_by"] | undefined,
	status?: GraphQLTypes["order_by"] | undefined,
	transactionDate?: GraphQLTypes["order_by"] | undefined,
	transactionType?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	updatedById?: GraphQLTypes["order_by"] | undefined
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
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	transactionDate?: GraphQLTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["InstituteFunding_stddev_fields"]: {
	__typename: "InstituteFunding_stddev_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["InstituteFunding_stddev_pop_fields"]: {
	__typename: "InstituteFunding_stddev_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["InstituteFunding_stddev_samp_fields"]: {
	__typename: "InstituteFunding_stddev_samp_fields",
	cursorId?: number | undefined
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
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	instituteId?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	purpose?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	transactionDate?: GraphQLTypes["date"] | undefined,
	transactionType?: string | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["InstituteFunding_sum_fields"]: {
	__typename: "InstituteFunding_sum_fields",
	cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** update columns of table "InstituteFunding" */
["InstituteFunding_update_column"]: InstituteFunding_update_column;
	["InstituteFunding_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["InstituteFunding_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["InstituteFunding_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["InstituteFunding_bool_exp"]
};
	/** aggregate var_pop on columns */
["InstituteFunding_var_pop_fields"]: {
	__typename: "InstituteFunding_var_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["InstituteFunding_var_samp_fields"]: {
	__typename: "InstituteFunding_var_samp_fields",
	cursorId?: number | undefined
};
	/** aggregate variance on columns */
["InstituteFunding_variance_fields"]: {
	__typename: "InstituteFunding_variance_fields",
	cursorId?: number | undefined
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
	avg?: GraphQLTypes["Institute_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["Institute_max_fields"] | undefined,
	min?: GraphQLTypes["Institute_min_fields"] | undefined,
	stddev?: GraphQLTypes["Institute_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["Institute_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["Institute_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["Institute_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["Institute_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["Institute_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["Institute_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["Institute_avg_fields"]: {
	__typename: "Institute_avg_fields",
	cursorId?: number | undefined
};
	/** Boolean expression to filter rows from the table "Institute". All fields are combined with a logical 'AND'. */
["Institute_bool_exp"]: {
		_and?: Array<GraphQLTypes["Institute_bool_exp"]> | undefined,
	_not?: GraphQLTypes["Institute_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["Institute_bool_exp"]> | undefined,
	address?: GraphQLTypes["String_comparison_exp"] | undefined,
	city?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	createdById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	cursorId?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	dateOfEstablishment?: GraphQLTypes["date_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	isVerified?: GraphQLTypes["Boolean_comparison_exp"] | undefined,
	landmark?: GraphQLTypes["String_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	pin?: GraphQLTypes["String_comparison_exp"] | undefined,
	state?: GraphQLTypes["String_comparison_exp"] | undefined,
	status?: GraphQLTypes["Status_enum_comparison_exp"] | undefined,
	type?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedById?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	website?: GraphQLTypes["String_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "Institute" */
["Institute_constraint"]: Institute_constraint;
	/** input type for incrementing numeric columns in table "Institute" */
["Institute_inc_input"]: {
		cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "Institute" */
["Institute_insert_input"]: {
		address?: string | undefined,
	city?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateOfEstablishment?: GraphQLTypes["date"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate max on columns */
["Institute_max_fields"]: {
	__typename: "Institute_max_fields",
	address?: string | undefined,
	city?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateOfEstablishment?: GraphQLTypes["date"] | undefined,
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
["Institute_min_fields"]: {
	__typename: "Institute_min_fields",
	address?: string | undefined,
	city?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateOfEstablishment?: GraphQLTypes["date"] | undefined,
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
	createdAt?: GraphQLTypes["order_by"] | undefined,
	createdById?: GraphQLTypes["order_by"] | undefined,
	cursorId?: GraphQLTypes["order_by"] | undefined,
	dateOfEstablishment?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	isVerified?: GraphQLTypes["order_by"] | undefined,
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
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateOfEstablishment?: GraphQLTypes["date"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate stddev on columns */
["Institute_stddev_fields"]: {
	__typename: "Institute_stddev_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_pop on columns */
["Institute_stddev_pop_fields"]: {
	__typename: "Institute_stddev_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate stddev_samp on columns */
["Institute_stddev_samp_fields"]: {
	__typename: "Institute_stddev_samp_fields",
	cursorId?: number | undefined
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
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	createdById?: GraphQLTypes["uuid"] | undefined,
	cursorId?: GraphQLTypes["bigint"] | undefined,
	dateOfEstablishment?: GraphQLTypes["date"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isVerified?: boolean | undefined,
	landmark?: string | undefined,
	name?: string | undefined,
	pin?: string | undefined,
	state?: string | undefined,
	status?: GraphQLTypes["Status_enum"] | undefined,
	type?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedById?: GraphQLTypes["uuid"] | undefined,
	website?: string | undefined
};
	/** aggregate sum on columns */
["Institute_sum_fields"]: {
	__typename: "Institute_sum_fields",
	cursorId?: GraphQLTypes["bigint"] | undefined
};
	/** update columns of table "Institute" */
["Institute_update_column"]: Institute_update_column;
	["Institute_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["Institute_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["Institute_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["Institute_bool_exp"]
};
	/** aggregate var_pop on columns */
["Institute_var_pop_fields"]: {
	__typename: "Institute_var_pop_fields",
	cursorId?: number | undefined
};
	/** aggregate var_samp on columns */
["Institute_var_samp_fields"]: {
	__typename: "Institute_var_samp_fields",
	cursorId?: number | undefined
};
	/** aggregate variance on columns */
["Institute_variance_fields"]: {
	__typename: "Institute_variance_fields",
	cursorId?: number | undefined
};
	/** columns and relationships of "Status" */
["Status"]: {
	__typename: "Status",
	value: string
};
	/** aggregated selection of "Status" */
["Status_aggregate"]: {
	__typename: "Status_aggregate",
	aggregate?: GraphQLTypes["Status_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["Status"]>
};
	/** aggregate fields of "Status" */
["Status_aggregate_fields"]: {
	__typename: "Status_aggregate_fields",
	count: number,
	max?: GraphQLTypes["Status_max_fields"] | undefined,
	min?: GraphQLTypes["Status_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "Status". All fields are combined with a logical 'AND'. */
["Status_bool_exp"]: {
		_and?: Array<GraphQLTypes["Status_bool_exp"]> | undefined,
	_not?: GraphQLTypes["Status_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["Status_bool_exp"]> | undefined,
	value?: GraphQLTypes["String_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "Status" */
["Status_constraint"]: Status_constraint;
	["Status_enum"]: Status_enum;
	/** Boolean expression to compare columns of type "Status_enum". All fields are combined with logical 'AND'. */
["Status_enum_comparison_exp"]: {
		_eq?: GraphQLTypes["Status_enum"] | undefined,
	_in?: Array<GraphQLTypes["Status_enum"]> | undefined,
	_is_null?: boolean | undefined,
	_neq?: GraphQLTypes["Status_enum"] | undefined,
	_nin?: Array<GraphQLTypes["Status_enum"]> | undefined
};
	/** input type for inserting data into table "Status" */
["Status_insert_input"]: {
		value?: string | undefined
};
	/** aggregate max on columns */
["Status_max_fields"]: {
	__typename: "Status_max_fields",
	value?: string | undefined
};
	/** aggregate min on columns */
["Status_min_fields"]: {
	__typename: "Status_min_fields",
	value?: string | undefined
};
	/** response of any mutation on the table "Status" */
["Status_mutation_response"]: {
	__typename: "Status_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["Status"]>
};
	/** on_conflict condition type for table "Status" */
["Status_on_conflict"]: {
		constraint: GraphQLTypes["Status_constraint"],
	update_columns: Array<GraphQLTypes["Status_update_column"]>,
	where?: GraphQLTypes["Status_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "Status". */
["Status_order_by"]: {
		value?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: Status */
["Status_pk_columns_input"]: {
		value: string
};
	/** select columns of table "Status" */
["Status_select_column"]: Status_select_column;
	/** input type for updating data in table "Status" */
["Status_set_input"]: {
		value?: string | undefined
};
	/** Streaming cursor of the table "Status" */
["Status_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["Status_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["Status_stream_cursor_value_input"]: {
		value?: string | undefined
};
	/** update columns of table "Status" */
["Status_update_column"]: Status_update_column;
	["Status_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["Status_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["Status_bool_exp"]
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
	/** delete data from the table: "Status" */
	delete_Status?: GraphQLTypes["Status_mutation_response"] | undefined,
	/** delete single row from the table: "Status" */
	delete_Status_by_pk?: GraphQLTypes["Status"] | undefined,
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
	/** insert data into the table: "Status" */
	insert_Status?: GraphQLTypes["Status_mutation_response"] | undefined,
	/** insert a single row into the table: "Status" */
	insert_Status_one?: GraphQLTypes["Status"] | undefined,
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
	update_Institute_many?: Array<GraphQLTypes["Institute_mutation_response"] | undefined> | undefined,
	/** update data of the table: "Status" */
	update_Status?: GraphQLTypes["Status_mutation_response"] | undefined,
	/** update single row of the table: "Status" */
	update_Status_by_pk?: GraphQLTypes["Status"] | undefined,
	/** update multiples rows of table: "Status" */
	update_Status_many?: Array<GraphQLTypes["Status_mutation_response"] | undefined> | undefined
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
	Institute_by_pk?: GraphQLTypes["Institute"] | undefined,
	/** fetch data from the table: "Status" */
	Status: Array<GraphQLTypes["Status"]>,
	/** fetch aggregated fields from the table: "Status" */
	Status_aggregate: GraphQLTypes["Status_aggregate"],
	/** fetch data from the table: "Status" using primary key columns */
	Status_by_pk?: GraphQLTypes["Status"] | undefined
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
	Institute_stream: Array<GraphQLTypes["Institute"]>,
	/** fetch data from the table: "Status" */
	Status: Array<GraphQLTypes["Status"]>,
	/** fetch aggregated fields from the table: "Status" */
	Status_aggregate: GraphQLTypes["Status_aggregate"],
	/** fetch data from the table: "Status" using primary key columns */
	Status_by_pk?: GraphQLTypes["Status"] | undefined,
	/** fetch data from the table in a streaming manner: "Status" */
	Status_stream: Array<GraphQLTypes["Status"]>
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
	EGovernance_cursorId_key = "EGovernance_cursorId_key",
	EGovernance_pkey = "EGovernance_pkey"
}
/** select columns of table "EGovernance" */
export const enum EGovernance_select_column {
	address = "address",
	area = "area",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	description = "description",
	file = "file",
	id = "id",
	instituteId = "instituteId",
	name = "name",
	phoneNo = "phoneNo",
	serviceEndDate = "serviceEndDate",
	serviceStartDate = "serviceStartDate",
	status = "status",
	totalAmount = "totalAmount",
	updatedAt = "updatedAt",
	updatedById = "updatedById",
	website = "website"
}
/** update columns of table "EGovernance" */
export const enum EGovernance_update_column {
	address = "address",
	area = "area",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	description = "description",
	file = "file",
	id = "id",
	instituteId = "instituteId",
	name = "name",
	phoneNo = "phoneNo",
	serviceEndDate = "serviceEndDate",
	serviceStartDate = "serviceStartDate",
	status = "status",
	totalAmount = "totalAmount",
	updatedAt = "updatedAt",
	updatedById = "updatedById",
	website = "website"
}
/** unique or primary key constraints on table "FacultyFunding" */
export const enum FacultyFunding_constraint {
	FacultyFunding_cursorId_key = "FacultyFunding_cursorId_key",
	FacultyFunding_pkey = "FacultyFunding_pkey"
}
/** select columns of table "FacultyFunding" */
export const enum FacultyFunding_select_column {
	amount = "amount",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	facultyId = "facultyId",
	file = "file",
	id = "id",
	instituteId = "instituteId",
	nature = "nature",
	status = "status",
	transactionDate = "transactionDate",
	transactionType = "transactionType",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** update columns of table "FacultyFunding" */
export const enum FacultyFunding_update_column {
	amount = "amount",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	facultyId = "facultyId",
	file = "file",
	id = "id",
	instituteId = "instituteId",
	nature = "nature",
	status = "status",
	transactionDate = "transactionDate",
	transactionType = "transactionType",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** unique or primary key constraints on table "Faculty" */
export const enum Faculty_constraint {
	Faculty_cursorId_key = "Faculty_cursorId_key",
	Faculty_pkey = "Faculty_pkey"
}
/** select columns of table "Faculty" */
export const enum Faculty_select_column {
	address = "address",
	cast = "cast",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	dateOfJoining = "dateOfJoining",
	designation = "designation",
	dob = "dob",
	emailId = "emailId",
	experience = "experience",
	gender = "gender",
	id = "id",
	instituteId = "instituteId",
	isVerified = "isVerified",
	jobType = "jobType",
	minority = "minority",
	name = "name",
	panCardNo = "panCardNo",
	phoneNo = "phoneNo",
	qualification = "qualification",
	section = "section",
	staffType = "staffType",
	status = "status",
	statusOfApproval = "statusOfApproval",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** update columns of table "Faculty" */
export const enum Faculty_update_column {
	address = "address",
	cast = "cast",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	dateOfJoining = "dateOfJoining",
	designation = "designation",
	dob = "dob",
	emailId = "emailId",
	experience = "experience",
	gender = "gender",
	id = "id",
	instituteId = "instituteId",
	isVerified = "isVerified",
	jobType = "jobType",
	minority = "minority",
	name = "name",
	panCardNo = "panCardNo",
	phoneNo = "phoneNo",
	qualification = "qualification",
	section = "section",
	staffType = "staffType",
	status = "status",
	statusOfApproval = "statusOfApproval",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** unique or primary key constraints on table "FdpPdp" */
export const enum FdpPdp_constraint {
	FdpPdp_cursorId_key = "FdpPdp_cursorId_key",
	FdpPdp_pkey = "FdpPdp_pkey"
}
/** select columns of table "FdpPdp" */
export const enum FdpPdp_select_column {
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	dateFrom = "dateFrom",
	dateTo = "dateTo",
	description = "description",
	facultyId = "facultyId",
	file = "file",
	id = "id",
	instituteId = "instituteId",
	name = "name",
	nature = "nature",
	status = "status",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById",
	venue = "venue"
}
/** update columns of table "FdpPdp" */
export const enum FdpPdp_update_column {
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	dateFrom = "dateFrom",
	dateTo = "dateTo",
	description = "description",
	facultyId = "facultyId",
	file = "file",
	id = "id",
	instituteId = "instituteId",
	name = "name",
	nature = "nature",
	status = "status",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById",
	venue = "venue"
}
/** unique or primary key constraints on table "Genesis" */
export const enum Genesis_constraint {
	Genesis_emailId_key = "Genesis_emailId_key",
	Genesis_phoneNo_key = "Genesis_phoneNo_key",
	Genesis_pkey = "Genesis_pkey"
}
/** select columns of table "Genesis" */
export const enum Genesis_select_column {
	createdAt = "createdAt",
	emailId = "emailId",
	id = "id",
	isVerified = "isVerified",
	name = "name",
	phoneNo = "phoneNo",
	role = "role",
	updatedAt = "updatedAt"
}
/** update columns of table "Genesis" */
export const enum Genesis_update_column {
	createdAt = "createdAt",
	emailId = "emailId",
	id = "id",
	isVerified = "isVerified",
	name = "name",
	phoneNo = "phoneNo",
	role = "role",
	updatedAt = "updatedAt"
}
/** unique or primary key constraints on table "InstituteFunding" */
export const enum InstituteFunding_constraint {
	InstituteFunding_cursorId_key = "InstituteFunding_cursorId_key",
	InstituteFunding_pkey = "InstituteFunding_pkey"
}
/** select columns of table "InstituteFunding" */
export const enum InstituteFunding_select_column {
	amount = "amount",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	id = "id",
	instituteId = "instituteId",
	name = "name",
	purpose = "purpose",
	status = "status",
	transactionDate = "transactionDate",
	transactionType = "transactionType",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** update columns of table "InstituteFunding" */
export const enum InstituteFunding_update_column {
	amount = "amount",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	id = "id",
	instituteId = "instituteId",
	name = "name",
	purpose = "purpose",
	status = "status",
	transactionDate = "transactionDate",
	transactionType = "transactionType",
	type = "type",
	updatedAt = "updatedAt",
	updatedById = "updatedById"
}
/** unique or primary key constraints on table "Institute" */
export const enum Institute_constraint {
	Institute_cursorId_key = "Institute_cursorId_key",
	Institute_pkey = "Institute_pkey"
}
/** select columns of table "Institute" */
export const enum Institute_select_column {
	address = "address",
	city = "city",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	dateOfEstablishment = "dateOfEstablishment",
	id = "id",
	isVerified = "isVerified",
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
/** update columns of table "Institute" */
export const enum Institute_update_column {
	address = "address",
	city = "city",
	createdAt = "createdAt",
	createdById = "createdById",
	cursorId = "cursorId",
	dateOfEstablishment = "dateOfEstablishment",
	id = "id",
	isVerified = "isVerified",
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
/** unique or primary key constraints on table "Status" */
export const enum Status_constraint {
	Status_pkey = "Status_pkey"
}
export const enum Status_enum {
	ACTIVE = "ACTIVE",
	APPROVED = "APPROVED",
	DELETED = "DELETED",
	INACTIVE = "INACTIVE",
	PENDING = "PENDING",
	REJECTED = "REJECTED"
}
/** select columns of table "Status" */
export const enum Status_select_column {
	value = "value"
}
/** update columns of table "Status" */
export const enum Status_update_column {
	value = "value"
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
	["EGovernance_inc_input"]: ValueTypes["EGovernance_inc_input"];
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
	["FacultyFunding_inc_input"]: ValueTypes["FacultyFunding_inc_input"];
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
	["Faculty_inc_input"]: ValueTypes["Faculty_inc_input"];
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
	["FdpPdp_inc_input"]: ValueTypes["FdpPdp_inc_input"];
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
	["InstituteFunding_inc_input"]: ValueTypes["InstituteFunding_inc_input"];
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
	["Institute_inc_input"]: ValueTypes["Institute_inc_input"];
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
	["Status_bool_exp"]: ValueTypes["Status_bool_exp"];
	["Status_constraint"]: ValueTypes["Status_constraint"];
	["Status_enum"]: ValueTypes["Status_enum"];
	["Status_enum_comparison_exp"]: ValueTypes["Status_enum_comparison_exp"];
	["Status_insert_input"]: ValueTypes["Status_insert_input"];
	["Status_on_conflict"]: ValueTypes["Status_on_conflict"];
	["Status_order_by"]: ValueTypes["Status_order_by"];
	["Status_pk_columns_input"]: ValueTypes["Status_pk_columns_input"];
	["Status_select_column"]: ValueTypes["Status_select_column"];
	["Status_set_input"]: ValueTypes["Status_set_input"];
	["Status_stream_cursor_input"]: ValueTypes["Status_stream_cursor_input"];
	["Status_stream_cursor_value_input"]: ValueTypes["Status_stream_cursor_value_input"];
	["Status_update_column"]: ValueTypes["Status_update_column"];
	["Status_updates"]: ValueTypes["Status_updates"];
	["String_comparison_exp"]: ValueTypes["String_comparison_exp"];
	["bigint"]: ValueTypes["bigint"];
	["bigint_comparison_exp"]: ValueTypes["bigint_comparison_exp"];
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