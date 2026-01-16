export type PackActionHandlerContext = {
    entityKey: string;
    record: any;
    uiSpec?: any;
    navigate?: (path: string) => void;
};
export type PackContrib = {
    actionHandlers?: Record<string, (ctx: PackActionHandlerContext) => void | Promise<void>>;
};
export declare const contrib: PackContrib;
export default contrib;
//# sourceMappingURL=index.d.ts.map