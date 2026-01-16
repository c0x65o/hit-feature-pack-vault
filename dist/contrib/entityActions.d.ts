export type PackActionHandlerContext = {
    entityKey: string;
    record: any;
    uiSpec?: any;
    navigate?: (path: string) => void;
};
export declare const actionHandlers: Record<string, (ctx: PackActionHandlerContext) => void | Promise<void>>;
//# sourceMappingURL=entityActions.d.ts.map