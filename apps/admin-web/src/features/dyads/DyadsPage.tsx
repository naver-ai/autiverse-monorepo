import { getAllDyadsApi } from "./api";
import { useQuery } from "@tanstack/react-query";
import { NewDyadPanel } from "./components/NewDyadPanel";
import { NewInterestModal } from "./components/NewInterestModal";
import { NewPersonModal } from "./components/NewPersonModal";
import { NewPlaceModal } from "./components/NewPlaceModal";
import { DyadCard } from "./components/DyadCard";
import { useInterestModalStore, usePersonModalStore, usePlaceModalStore } from "./store";

export const DyadsPage = () => {
    const { isOpen: isInterestModalOpen, selectedDyadId: selectedInterestDyadId, closeInterestModal } = useInterestModalStore();
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
        <NewInterestModal
            isOpen={isInterestModalOpen}
            dyadId={selectedInterestDyadId}
            onClose={closeInterestModal}
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