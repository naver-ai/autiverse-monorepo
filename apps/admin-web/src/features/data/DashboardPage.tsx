import { Card, Button } from "antd"
import { useMutation } from "@tanstack/react-query"
import { exportJsonAPI, exportDbAPI } from "./api"
import { format } from "date-fns"

export const DashboardPage = () => {

    const exportJsonMutation = useMutation({
        mutationFn: exportJsonAPI,
        onSuccess: (data) => {
            // Create filename with current timestamp
            const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
            const filename = `autihero-data-${timestamp}.json`;
            
            // Convert data to JSON string
            const jsonString = JSON.stringify(data, null, 2);
            
            // Create blob and download
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            URL.revokeObjectURL(url);
        }
    })

    const exportDbMutation = useMutation({
        mutationFn: exportDbAPI,
        onSuccess: (data) => {
            // Create filename with current timestamp
            const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
            const filename = `autihero-db-${timestamp}.zip`;
            
            // Create blob and download
            const blob = new Blob([data], { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            URL.revokeObjectURL(url);
        }
    })

    


    return <div className="container mx-auto p-4">
            <Card title="Data">
                <div className="flex flex-wrap gap-4">
                    <Button type="primary" onClick={() => exportJsonMutation.mutate()} loading={exportJsonMutation.isPending}>
                        Export JSON
                    </Button>
                    <Button type="primary" onClick={() => exportDbMutation.mutate()} loading={exportDbMutation.isPending}>
                        Export Database and Files
                    </Button>
                </div>
            </Card>
        </div>
}