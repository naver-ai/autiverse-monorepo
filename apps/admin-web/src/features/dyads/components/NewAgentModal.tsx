import { Modal, Form, Input, Button, message } from 'antd';
import { useCreateAgentMutation } from '../api';

interface NewAgentModalProps {
  isOpen: boolean;
  dyadId: string | null;
  onClose: () => void;
}

export const NewAgentModal = ({ isOpen, dyadId, onClose }: NewAgentModalProps) => {
  const [form] = Form.useForm();
  const createAgentMutation = useCreateAgentMutation();

  const handleSubmit = async (values: { interest: string; agent_name: string; agent_config?: string }) => {
    if (!dyadId) return;

    try {
      const agentConfig = values.agent_config ? JSON.parse(values.agent_config) : undefined;
      
      await createAgentMutation.mutateAsync({
        dyadId,
        data: {
          interest: values.interest,
          agent_name: values.agent_name,
          agent_config: agentConfig
        }
      });

      message.success('Agent created successfully');
      form.resetFields();
      onClose();
    } catch (error) {
      console.error('Error creating agent:', error);
      message.error('Failed to create agent');
    }
  };

  return (
    <Modal
      title="Add New Agent"
      open={isOpen}
      onCancel={onClose}
      footer={null}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          label="Interest"
          name="interest"
          rules={[{ required: true, message: 'Please enter the interest' }]}
        >
          <Input placeholder="Enter interest" />
        </Form.Item>

        <Form.Item
          label="Agent Name"
          name="agent_name"
          rules={[{ required: true, message: 'Please enter the agent name' }]}
        >
          <Input placeholder="Enter agent name" />
        </Form.Item>

        <Form.Item
          label="Agent Config (JSON)"
          name="agent_config"
          rules={[
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                try {
                  JSON.parse(value);
                  return Promise.resolve();
                } catch (error) {
                  return Promise.reject(new Error('Please enter valid JSON'));
                }
              }
            }
          ]}
        >
          <Input.TextArea 
            placeholder="Enter agent configuration as JSON (optional)"
            rows={4}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={createAgentMutation.isPending}
            block
          >
            Create Agent
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}; 