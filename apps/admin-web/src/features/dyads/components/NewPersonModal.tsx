import { Modal, message, Input, Form, Button } from "antd";
import { useCreatePersonMutation } from "../api";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { FormItem } from "../../../components/react-hook-form-antd";

interface NewPersonModalProps {
    isOpen: boolean;
    dyadId: string | null;
    onClose: () => void;
}

interface PersonFormData {
    name: string;
}

const schema = yup.object({
    name: yup.string().required('Please input the person name')
}).required();

export const NewPersonModal = ({ isOpen, dyadId, onClose }: NewPersonModalProps) => {
    const { control, handleSubmit, reset, setFocus, formState: {isValid, isSubmitting} } = useForm<PersonFormData>({
        resolver: yupResolver(schema),
        reValidateMode: 'onChange'
    });

    const createPersonMutation = useCreatePersonMutation();

    const onSubmit = async (data: PersonFormData) => {
        if (dyadId) {
            createPersonMutation.mutate({
                dyadId,
                data
            }, {
                onSuccess: () => {
                    message.success('Person added successfully');
                    onClose();
                    reset();
                },
                onError: (error) => {
                    message.error('Failed to add person');
                    console.error('Error adding person:', error);
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
            title="Add New Person"
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
                    label="Person Name"
                >
                    <Input autoFocus placeholder="Enter person name"/>
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
                        Add Person
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}; 