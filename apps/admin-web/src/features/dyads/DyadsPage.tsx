import { getAllDyadsApi } from "./api";
import { useQuery } from "@tanstack/react-query";
import { NewDyadPanel } from "./components/NewDyadPanel";
import { NewAgentModal } from "./components/NewAgentModal";
import { NewPersonModal } from "./components/NewPersonModal";
import { NewPlaceModal } from "./components/NewPlaceModal";
import { DyadCard } from "./components/DyadCard";
import { useAgentModalStore, usePersonModalStore, usePlaceModalStore } from "./store";

export const DyadsPage = () => {
    const { isOpen: isAgentModalOpen, selectedDyadId: selectedAgentDyadId, closeAgentModal } = useAgentModalStore();
    const { isOpen: isPersonModalOpen, selectedDyadId: selectedPersonDyadId, closePersonModal } = usePersonModalStore();
    const { isOpen: isPlaceModalOpen, selectedDyadId: selectedPlaceDyadId, closePlaceModal } = usePlaceModalStore();

    const { data: dyads } = useQuery({
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
        <NewAgentModal
            isOpen={isAgentModalOpen}
            dyadId={selectedAgentDyadId}
            onClose={closeAgentModal}
        />
        <NewPersonModal
            isOpen={isPersonModalOpen}
            dyadId={selectedPersonDyadId}
            onClose={closePersonModal}
        />
        <NewPlaceModal
            isOpen={isPlaceModalOpen}
            dyadId={selectedPlaceDyadId}
            onClose={closePlaceModal}
        />
    </div>
}