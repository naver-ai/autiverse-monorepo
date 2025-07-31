import { Button, Tooltip } from 'antd';
import colors from 'tailwindcss/colors';
import { twMerge } from 'tailwind-merge';
import { CheckIcon } from '@heroicons/react/16/solid';

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