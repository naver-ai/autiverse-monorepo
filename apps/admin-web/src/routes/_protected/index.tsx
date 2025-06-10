import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { verifyTokenApi } from '../../features/auth/api';

export const Route = createFileRoute('/_protected/')({
    beforeLoad: async () => {
        const isValid = await verifyTokenApi();
        if (!isValid) {
            throw redirect({
                to: '/signin',
            });
        }
        
        // Redirect to /users if user is on the index page
        throw redirect({
            to: '/dyads/list',
        });
    },
    component: () => <Outlet />,
}); 