import { Modal, message, Input, Form, Button } from "antd";
import { useCreateInterestMutation } from "../api";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { FormItem } from "../../../components/react-hook-form-antd";

interface NewInterestModalProps {
    isOpen: boolean;
    dyadId: string | null;
    onClose: () => void;
}

interface InterestFormData {
    name_localized: string;
    name_english: string;
}

const schema = yup.object({
    name_localized: yup.string().required('Please input the localized interest name!'),
    name_english: yup.string().required('Please input the English interest name!')
}).required();

export const NewInterestModal = ({ isOpen, dyadId, onClose }: NewInterestModalProps) => {
    const { control, handleSubmit, reset, setFocus, formState: {isValid, isSubmitting} } = useForm<InterestFormData>({
        resolver: yupResolver(schema),
        reValidateMode: 'onChange'
    });

    const createInterestMutation = useCreateInterestMutation();

    const onSubmit = async (data: InterestFormData) => {
        if (dyadId) {
            createInterestMutation.mutate({
                dyadId,
                data
            }, {
                onSuccess: () => {
                    message.success('Interest added successfully');
                    onClose();
                    reset();
                },
                onError: (error) => {
                    message.error('Failed to add interest');
                    console.error('Error adding interest:', error);
                }
            });
        }
    };

    return (
        <Modal
            afterOpenChange={(open) => {
                if (open) {
                    reset();
                    setFocus('name_localized');
                }
            }}
            title="Add New Interest"
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
                    name="name_localized"
                    label="Interest Name (Localized)"
                    
                >
                    <Input autoFocus placeholder="Interest in the user's locale language"/>
                </FormItem>
                <FormItem
                    control={control}
                    name="name_english"
                    label="Interest Name (English)"
                >
                    <Input placeholder="Interest in English"/>
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
                        Add Interest
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}; 