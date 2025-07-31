import { Modal, Form, Input, Button, message, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useCreateAgentMutation, useUploadAgentImageMutation } from '../api';
import { useState } from 'react';

interface NewAgentModalProps {
  isOpen: boolean;
  dyadId: string | null;
  onClose: () => void;
}

export const NewAgentModal = ({ isOpen, dyadId, onClose }: NewAgentModalProps) => {
  const [form] = Form.useForm();
  const createAgentMutation = useCreateAgentMutation();
  const uploadImageMutation = useUploadAgentImageMutation();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const handleImageUpload = async (file: File) => {
    try {
      const result = await uploadImageMutation.mutateAsync(file);
      setUploadedImage(result.filename);
      message.success('이미지가 업로드되었습니다.');
      return false;
    } catch (error) {
      message.error('이미지 업로드에 실패했습니다.');
      return false;
    }
  };

  const handleSubmit = async (values: { interest: string; agent_name: string; agent_config?: string }) => {
    if (!dyadId) return;

    try {
      let agentConfig = values.agent_config ? JSON.parse(values.agent_config) : {};
      
      if (uploadedImage) {
        agentConfig = {
          ...agentConfig,
          avatar_image: uploadedImage
        };
      }
      
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
      setUploadedImage(null);
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
          label="Agent Image"
          name="agent_image"
        >
          <Upload
            beforeUpload={handleImageUpload}
            showUploadList={false}
            accept="image/*"
          >
            <Button icon={<UploadOutlined />}>
              {uploadedImage ? 'Image Uploaded' : 'Upload Agent Image'}
            </Button>
          </Upload>
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
            loading={createAgentMutation.isPending || uploadImageMutation.isPending}
            block
          >
            Create Agent
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}; 