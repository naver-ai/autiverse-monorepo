import { createFileRoute, redirect } from '@tanstack/react-router';
import { verifyTokenApi } from '../../features/auth/api';
import { SignedInLayout } from '../../features/layout/SignedInLayout';

export const Route = createFileRoute('/_protected/_layout')({
    beforeLoad: async () => {
        const isValid = await verifyTokenApi();
        if (!isValid) {
            throw redirect({
                to: '/signin',
            });
        }
    },
    component: SignedInLayout
}); 