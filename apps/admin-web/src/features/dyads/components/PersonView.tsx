import { Person } from '@autiverse-monorepo/ts-core';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { Button } from 'antd';
import { useDeletePersonMutation, useUpdatePersonColorMutation } from '../api';
import { ColorPickerPopoverButton } from './AvatarColorPicker';

export const PersonView = ({
  person,
  dyadId,
}: {
  person: Person;
  dyadId: string;
}) => {
  const deletePersonMutation = useDeletePersonMutation();
  const updatePersonColorMutation = useUpdatePersonColorMutation();

  const displayName = person.name;

  return (
    <div className="flex items-center gap-x-2 border p-1  rounded-md" key={person.id}>
      <ColorPickerPopoverButton selectedColor={person.avatar_config?.color} onChange={async (color) => {
        await updatePersonColorMutation.mutateAsync({
          dyadId: dyadId,
          personId: person.id,
          color: color,
        });
      }} />
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
