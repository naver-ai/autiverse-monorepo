import { Person } from '@autiverse-monorepo/ts-core';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { Button, Popover, Tooltip } from 'antd';
import { useDeletePersonMutation, useUpdatePersonColorMutation } from '../api';
import { twMerge } from 'tailwind-merge';
import { AvatarColorPicker } from './AvatarColorPicker';
import { useState } from 'react';

export const PersonView = ({
  person,
  dyadId,
}: {
  person: Person;
  dyadId: string;
}) => {
  const deletePersonMutation = useDeletePersonMutation();
  const updatePersonColorMutation = useUpdatePersonColorMutation();

  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const displayName = person.name;

  return (
    <div className="flex items-center gap-x-2 border p-1  rounded-md" key={person.id}>
    <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen} content={<div className="flex flex-col gap-y-1">
        <AvatarColorPicker selectedColor={person.avatar_config?.color} onClick={async (color) => {
          await updatePersonColorMutation.mutateAsync({
            dyadId: dyadId,
            personId: person.id,
            color: color,
          });
          setIsPickerOpen(false);
        }} />
    </div>}>
      <Button type="text" size="small" 
        style={{ backgroundColor: person.avatar_config?.color }}
        className={twMerge("block w-5 h-5 border-2 border-white shadow-md rounded-full", person.avatar_config?. color == null ? "flex items-center justify-center" : null)}>
        {person.avatar_config?.color == null ? <span className="text-sm font-bold text-red-400 pointer-events-none">!</span> : null}
      </Button>
      </Popover>
      <span className="text-sm">{displayName}</span>
      <Button
        type="text"
        size="small"
        onClick={() => {
          if (window.confirm('Are you sure you want to delete this person?')) {
            deletePersonMutation.mutate({
              dyadId: dyadId,
              personId: person.id,
            });
          }
        }}
      >
        <XMarkIcon className="w-4 h-4" />
      </Button>
    </div>
  );
};
