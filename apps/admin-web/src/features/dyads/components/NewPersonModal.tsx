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
    avatar_config?: string;
}

const schema = yup.object({
    name: yup.string().required('Please input the person name'),
    avatar_config: yup.string().test('is-json', 'Please enter valid JSON', function(value) {
        if (!value) return true;
        try {
            JSON.parse(value);
            return true;
        } catch {
            return false;
        }
    })
}).required();

export const NewPersonModal = ({ isOpen, dyadId, onClose }: NewPersonModalProps) => {
    const { control, handleSubmit, reset, setFocus, formState: {isValid, isSubmitting} } = useForm<PersonFormData>({
        resolver: yupResolver(schema),
        reValidateMode: 'onChange'
    });

    const createPersonMutation = useCreatePersonMutation();

    const onSubmit = async (data: PersonFormData) => {
        if (dyadId) {
            const avatarConfig = data.avatar_config ? JSON.parse(data.avatar_config) : undefined;
            
            createPersonMutation.mutate({
                dyadId,
                data: {
                    name: data.name,
                    avatar_config: avatarConfig
                }
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
                <FormItem
                    control={control}
                    name="avatar_config"
                    label="Avatar Config (JSON)"
                >
                    <Input.TextArea 
                        placeholder="Enter avatar configuration as JSON (optional)"
                        rows={4}
                    />
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