import { Button, Layout, Menu } from "antd"
import {Outlet, useLocation, useNavigate} from '@tanstack/react-router'
import { UserCircleIcon, BookOpenIcon } from '@heroicons/react/24/solid'
import { useQuery } from "@tanstack/react-query"
import { getAllDyadsApi } from "../dyads/api"
import { Dyad } from 'ts-core'

export const SignedInLayout = () => {
    const navigate = useNavigate()
    const location = useLocation()

    const { data: dyads } = useQuery<Dyad[]>({
        queryKey: ['dyads'],
        queryFn: getAllDyadsApi
    })

    const onSignOut = () => {
        if(window.confirm("Are you sure you want to sign out?")) {
            localStorage.removeItem('auth_token');
            window.location.reload();
        }
    }

    const handleMenuClick = ({ key }: { key: string }) => {
        navigate({ to: `/${key}` })
    }

    const menuItems = [
        {
            label: 'Dyads',
            key: 'dyads/list',
            icon: <UserCircleIcon className="w-5 h-5" />,
        },
        {
            label: 'Books',
            key: 'books',
            icon: <BookOpenIcon className="w-5 h-5" />,
            children: dyads?.map((dyad: Dyad) => ({
                label: dyad.alias,
                key: `dyads/${dyad.id}/books`,
            })) || []
        }
    ]

    const pathParts = location.pathname.split('/').filter(Boolean)
    const selectedKeys = pathParts.length > 1 
        ? [`${pathParts[0]}/${pathParts[1]}`]
        : [pathParts[0] || 'dyads/list']

    return <Layout className="bg-transparent h-[100vh] overflow-hidden">
        <Layout.Header className="bg-slate-100 border-b p-2 h-12 flex items-center justify-between">
            <div className="font-bold text-[12pt]">AutiHero Admin</div>
        
            <Button variant="outlined" size="small" onClick={onSignOut}>Logout</Button>
        </Layout.Header>
        <Layout hasSider>
            <Layout.Sider className="bg-white border-r">
                <Menu 
                    items={menuItems} 
                    mode="inline" 
                    onClick={handleMenuClick}
                    selectedKeys={selectedKeys}
                />
            </Layout.Sider>
            <Layout.Content className="bg-white overflow-y-auto">
                <Outlet />
            </Layout.Content>
        </Layout>
    </Layout>
}