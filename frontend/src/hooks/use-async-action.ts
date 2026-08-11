import { useState } from 'react';

export default function useAsyncAction(action?: () => Promise<void>) {
    const [isLoading, setIsLoading] = useState(false);

    async function execute() {
        if (!action) return;
        setIsLoading(true);
        try {
            await action();
        } catch (e) {
            alert(e);
        } finally {
            setIsLoading(false);
        }
    }

    return [execute, isLoading] as const;
}
