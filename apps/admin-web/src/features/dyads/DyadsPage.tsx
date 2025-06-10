import { Button, Table } from "antd"
import { ColumnsType } from "antd/es/table";
import { getAllDyadsApi, useDeleteInterestMutation } from "./api";
import { useQuery } from "@tanstack/react-query";
import { Dyad, Interest } from "@autiverse-monorepo/ts-core";
import { NewDyadPanel } from "./components/NewDyadPanel";
import { NewInterestModal } from "./components/NewInterestModal";
import { useMemo } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { DyadCard } from "./components/DyadCard";
import { useInterestModalStore } from "./store";

export const DyadsPage = () => {
    const { isOpen, selectedDyadId, closeInterestModal } = useInterestModalStore();

    const { data: dyads, isLoading } = useQuery({
        queryKey: ['dyads'],
        queryFn: getAllDyadsApi
    });

    return <div className="container mx-auto p-4">
        <NewDyadPanel/>
        <div className="flex flex-col gap-4 mt-8">
        {
            dyads?.map(dyad => (
                <DyadCard key={dyad.id} dyad={dyad} />
            ))
        }
        </div>
        <NewInterestModal
            isOpen={isOpen}
            dyadId={selectedDyadId}
            onClose={closeInterestModal}
        />
    </div>
}