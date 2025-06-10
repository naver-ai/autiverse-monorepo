import { Modal, message, Input, Form, Button } from "antd";
import { useCreatePlaceMutation } from "../api";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { FormItem } from "../../../components/react-hook-form-antd";

interface NewPlaceModalProps {
    isOpen: boolean;
    dyadId: string | null;
    onClose: () => void;
}

interface PlaceFormData {
    name: string;
}

const schema = yup.object({
    name: yup.string().required('Please input the place name')
}).required();

export const NewPlaceModal = ({ isOpen, dyadId, onClose }: NewPlaceModalProps) => {
    const { control, handleSubmit, reset, setFocus, formState: {isValid, isSubmitting} } = useForm<PlaceFormData>({
        resolver: yupResolver(schema),
        reValidateMode: 'onChange'
    });

    const createPlaceMutation = useCreatePlaceMutation();

    const onSubmit = async (data: PlaceFormData) => {
        if (dyadId) {
            createPlaceMutation.mutate({
                dyadId,
                data
            }, {
                onSuccess: () => {
                    message.success('Place added successfully');
                    onClose();
                    reset();
                },
                onError: (error) => {
                    message.error('Failed to add place');
                    console.error('Error adding place:', error);
                }
            });
        }
    };

    return (
        <Modal
            afterOpenChange={(open) => {
                if (open) {
                    reset();
                    setFocus('name');
                }
            }}
            title="Add New Place"
            open={isOpen}
            onCancel={() => {
                onClose();
                reset();
            }}
            footer={null}
        >
            <Form onFinish={handleSubmit(onSubmit)} className="space-y-4">
                <FormItem
                    control={control}
                    name="name"
                    label="Place Name"
                >
                    <Input autoFocus placeholder="Place name"/>
                </FormItem>
                <div className="flex justify-end gap-2 mt-4">
                    <Button
                        onClick={() => {
                            onClose();
                            reset();
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={isSubmitting}
                        disabled={!isValid}
                    >
                        Add Place
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}; 