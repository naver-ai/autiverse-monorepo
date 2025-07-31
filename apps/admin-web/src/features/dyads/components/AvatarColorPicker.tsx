import { Button, Popover, Tooltip } from 'antd';
import colors from 'tailwindcss/colors';
import { twMerge } from 'tailwind-merge';
import { CheckIcon } from '@heroicons/react/16/solid';
import { Control, FieldPath, useController } from 'react-hook-form';
import { useState } from 'react';

const SUPPORT_TAILWIND_COLORS = ['slate', 'red', 'orange', 'amber', 'lime', 'emerald', 'cyan', 'sky', 'purple', 'pink']

const SUPPORT_TAILWIND_RANGES = [400, 500, 600, 700]

export const AvatarColorPicker = ({onClick, selectedColor}: {onClick?: (color: string) => void, selectedColor?: string}) => {
    
    return <div className="flex items-start gap-2">
        {
            SUPPORT_TAILWIND_COLORS.map(color => (
                <div key={color} className="flex flex-col gap-y-1">
                    {
                        SUPPORT_TAILWIND_RANGES.map(range => {
                            const colorCategory = colors[color as keyof typeof colors]
                            const colorString = colorCategory[range as keyof typeof colorCategory]

                            const isSelected = selectedColor === colorString

                            return <Tooltip title={colorString} key={range} placement="top">
                                <Button key={range} type="text" size="small" className={twMerge("block w-5 h-5 p-0 border-2 border-white hover:opacity-70 shadow-md rounded-full", isSelected ? "rounded-md border-0 flex items-center justify-center" : "outline-none")} style={{ backgroundColor: colorString }} onClick={() => {
                                    onClick?.(colorString)
                                }}>
                                    {
                                        isSelected ? <CheckIcon className="w-4 h-4 text-white font-bold" /> : null
                                    }
                                </Button>
                            </Tooltip>
                        })
                    }
                </div>
            ))
        }
    </div>;
};



export const ColorPickerControl = ({control, name, mode = 'palette'}: {
    control: Control<any>;
    name: FieldPath<any>;
    mode?: 'palette' | 'popover';
}) => {

    const { field } = useController({name, control});

    return mode === 'popover' ? <ColorPickerPopoverButton selectedColor={field.value} onChange={field.onChange} /> : <AvatarColorPicker onClick={field.onChange} selectedColor={field.value} />
}

export const ColorPickerPopoverButton = ({selectedColor, onChange, className}: {selectedColor?: string, onChange?: (color: string) => void, className?: string}) => {
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    return <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen} content={<div className="flex flex-col gap-y-1">
        <AvatarColorPicker selectedColor={selectedColor} onClick={onChange} />
    </div>}>
      <Button type="text" size="small" 
        style={{ backgroundColor: selectedColor }}
        className={twMerge("block w-5 h-5 border-2 border-white shadow-md rounded-full", selectedColor == null ? "flex items-center justify-center" : null, className)}>
        {selectedColor == null ? <span className="text-sm font-bold text-red-400 pointer-events-none">!</span> : null}
      </Button>
      </Popover>
}