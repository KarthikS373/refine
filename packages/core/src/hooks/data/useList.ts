import {
    QueryObserverResult,
    useQuery,
    UseQueryOptions,
} from "@tanstack/react-query";
import {
    GetListResponse,
    CrudFilters,
    Pagination,
    BaseRecord,
    HttpError,
    CrudSorting,
    MetaQuery,
    SuccessErrorNotification,
    LiveModeProps,
    Prettify,
} from "../../interfaces";
import {
    useResource,
    useHandleNotification,
    useResourceSubscription,
    useTranslate,
    useDataProvider,
    useOnError,
    useMeta,
} from "@hooks";
import {
    queryKeys,
    pickDataProvider,
    pickNotDeprecated,
    useActiveAuthProvider,
    handlePaginationParams,
} from "@definitions/helpers";
import {
    useLoadingOvertime,
    UseLoadingOvertimeOptionsProps,
    UseLoadingOvertimeReturnType,
} from "../useLoadingOvertime";

export interface UseListConfig {
    pagination?: Pagination;
    hasPagination?: boolean;
    sort?: CrudSorting;
    filters?: CrudFilters;
}

export type BaseListProps = {
    /**
     * Configuration for pagination, sorting and filtering
     * @type [`UseListConfig`](/docs/api-reference/core/hooks/data/useList/#config-parameters)
     * @deprecated `config` property is deprecated. Use `pagination`, `hasPagination`, `sorters` and `filters` instead.
     */
    config?: UseListConfig;
    /**
     * Pagination properties
     */
    pagination?: Pagination;
    /**
     * Whether to use server-side pagination or not
     * @deprecated `hasPagination` property is deprecated. Use `pagination.mode` instead.
     */
    hasPagination?: boolean;
    /**
     * Sorter parameters
     */
    sorters?: CrudSorting;
    /**
     * Filter parameters
     */
    filters?: CrudFilters;
    /**
     * Meta data query for `dataProvider`
     */
    meta?: MetaQuery;
    /**
     * Meta data query for `dataProvider`
     * @deprecated `metaData` is deprecated with refine@4, refine will pass `meta` instead, however, we still support `metaData` for backward compatibility.
     */
    metaData?: MetaQuery;
    /**
     * If there is more than one `dataProvider`, you should use the `dataProviderName` that you will use
     */
    dataProviderName?: string;
};

export type UseListProps<TQueryFnData, TError, TData> = {
    /**
     * Resource name for API data interactions
     */
    resource?: string;

    /**
     * Tanstack Query's [useQuery](https://tanstack.com/query/v4/docs/reference/useQuery) options
     */
    queryOptions?: UseQueryOptions<
        GetListResponse<TQueryFnData>,
        TError,
        GetListResponse<TData>
    >;
} & BaseListProps &
    SuccessErrorNotification<
        GetListResponse<TData>,
        TError,
        Prettify<BaseListProps>
    > &
    LiveModeProps &
    UseLoadingOvertimeOptionsProps;

/**
 * `useList` is a modified version of `react-query`'s {@link https://react-query.tanstack.com/guides/queries `useQuery`} used for retrieving items from a `resource` with pagination, sort, and filter configurations.
 *
 * It uses the `getList` method as the query function from the `dataProvider` which is passed to `<Refine>`.
 *
 * @see {@link https://refine.dev/docs/api-reference/core/hooks/data/useList} for more details.
 *
 * @typeParam TQueryFnData - Result data returned by the query function. Extends {@link https://refine.dev/docs/api-reference/core/interfaceReferences#baserecord `BaseRecord`}
 * @typeParam TError - Custom error object that extends {@link https://refine.dev/docs/api-reference/core/interfaceReferences#httperror `HttpError`}
 * @typeParam TData - Result data returned by the `select` function. Extends {@link https://refine.dev/docs/api-reference/core/interfaceReferences#baserecord `BaseRecord`}. Defaults to `TQueryFnData`
 *
 */

export const useList = <
    TQueryFnData extends BaseRecord = BaseRecord,
    TError extends HttpError = HttpError,
    TData extends BaseRecord = TQueryFnData,
>({
    resource: resourceFromProp,
    config,
    filters,
    hasPagination,
    pagination,
    sorters,
    queryOptions,
    successNotification,
    errorNotification,
    meta,
    metaData,
    liveMode,
    onLiveEvent,
    liveParams,
    dataProviderName,
    overtimeOptions,
}: UseListProps<TQueryFnData, TError, TData>): QueryObserverResult<
    GetListResponse<TData>,
    TError
> &
    UseLoadingOvertimeReturnType => {
    const { resources, resource, identifier } = useResource(resourceFromProp);

    const dataProvider = useDataProvider();
    const translate = useTranslate();
    const authProvider = useActiveAuthProvider();
    const { mutate: checkError } = useOnError({
        v3LegacyAuthProviderCompatible: Boolean(authProvider?.isLegacy),
    });
    const handleNotification = useHandleNotification();
    const getMeta = useMeta();

    const pickedDataProvider = pickDataProvider(
        identifier,
        dataProviderName,
        resources,
    );
    const preferredMeta = pickNotDeprecated(meta, metaData);
    const prefferedFilters = pickNotDeprecated(filters, config?.filters);
    const prefferedSorters = pickNotDeprecated(sorters, config?.sort);
    const prefferedHasPagination = pickNotDeprecated(
        hasPagination,
        config?.hasPagination,
    );
    const prefferedPagination = handlePaginationParams({
        pagination,
        configPagination: config?.pagination,
        hasPagination: prefferedHasPagination,
    });
    const isServerPagination = prefferedPagination.mode === "server";

    const combinedMeta = getMeta({ resource, meta: preferredMeta });

    const notificationValues = {
        meta: combinedMeta,
        metaData: combinedMeta,
        filters: prefferedFilters,
        hasPagination: isServerPagination,
        pagination: prefferedPagination,
        sorters: prefferedSorters,
        config: {
            ...config,
            sort: prefferedSorters,
        },
    };

    const isEnabled =
        queryOptions?.enabled === undefined || queryOptions?.enabled === true;

    const queryKey = queryKeys(identifier, pickedDataProvider, preferredMeta);

    const { getList } = dataProvider(pickedDataProvider);

    useResourceSubscription({
        resource: identifier,
        types: ["*"],
        params: {
            meta: combinedMeta,
            metaData: combinedMeta,
            pagination: prefferedPagination,
            hasPagination: isServerPagination,
            sort: prefferedSorters,
            sorters: prefferedSorters,
            filters: prefferedFilters,
            subscriptionType: "useList",
            ...liveParams,
        },
        channel: `resources/${resource?.name}`,
        enabled: isEnabled,
        liveMode,
        onLiveEvent,
    });

    const queryResponse = useQuery<
        GetListResponse<TQueryFnData>,
        TError,
        GetListResponse<TData>
    >(
        queryKey.list({
            filters: prefferedFilters,
            hasPagination: isServerPagination,
            ...(isServerPagination && {
                pagination: prefferedPagination,
            }),
            ...(sorters && {
                sorters,
            }),
            ...(config?.sort && {
                sort: config?.sort,
            }),
        }),
        ({ queryKey, pageParam, signal }) => {
            return getList<TQueryFnData>({
                resource: resource?.name ?? "",
                pagination: prefferedPagination,
                hasPagination: isServerPagination,
                filters: prefferedFilters,
                sort: prefferedSorters,
                sorters: prefferedSorters,
                meta: {
                    ...combinedMeta,
                    queryContext: {
                        queryKey,
                        pageParam,
                        signal,
                    },
                },
                metaData: {
                    ...combinedMeta,
                    queryContext: {
                        queryKey,
                        pageParam,
                        signal,
                    },
                },
            });
        },
        {
            ...queryOptions,
            enabled:
                typeof queryOptions?.enabled !== "undefined"
                    ? queryOptions?.enabled
                    : !!resource?.name,
            select: (rawData) => {
                let data = rawData;

                const { current, mode, pageSize } = prefferedPagination;

                if (mode === "client") {
                    data = {
                        ...data,
                        data: data.data.slice(
                            (current - 1) * pageSize,
                            current * pageSize,
                        ),
                        total: data.total,
                    };
                }

                if (queryOptions?.select) {
                    return queryOptions?.select?.(data);
                }

                return data as unknown as GetListResponse<TData>;
            },
            onSuccess: (data) => {
                queryOptions?.onSuccess?.(data);

                const notificationConfig =
                    typeof successNotification === "function"
                        ? successNotification(
                              data,
                              notificationValues,
                              identifier,
                          )
                        : successNotification;

                handleNotification(notificationConfig);
            },
            onError: (err: TError) => {
                checkError(err);
                queryOptions?.onError?.(err);

                const notificationConfig =
                    typeof errorNotification === "function"
                        ? errorNotification(err, notificationValues, identifier)
                        : errorNotification;

                handleNotification(notificationConfig, {
                    key: `${identifier}-useList-notification`,
                    message: translate(
                        "notifications.error",
                        { statusCode: err.statusCode },
                        `Error (status code: ${err.statusCode})`,
                    ),
                    description: err.message,
                    type: "error",
                });
            },
        },
    );

    const { elapsedTime } = useLoadingOvertime({
        isLoading: queryResponse.isFetching,
        interval: overtimeOptions?.interval,
        onInterval: overtimeOptions?.onInterval,
    });

    return { ...queryResponse, overtime: { elapsedTime } };
};
