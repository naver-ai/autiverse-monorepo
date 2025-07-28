import { Form, Input, Button } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useMutation } from '@tanstack/react-query';
import { loginApi } from './api';
import { useNavigate } from '@tanstack/react-router';

// Define validation schema
const schema = yup.object().shape({
    password: yup.string().required('Password is required'),
});

type FormValues = {
    password: string;
};

export const SignInPage = () => {
    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting, isValid },
    } = useForm<FormValues>({
        resolver: yupResolver(schema),
        mode: 'onChange',
    });

    const navigate = useNavigate();

    const loginMutation = useMutation({
        mutationFn: (data: FormValues) => loginApi(data.password),
        onSuccess: (data) => {
            // Handle successful login
            localStorage.setItem('auth_token', data);
            navigate({ to: '/dyads/list' });
        },
        onError: (error) => {
            // Handle login error
            console.error('Login failed:', error);
        },
    });

    const onSubmit = async (data: FormValues) => {
        loginMutation.mutate(data);
    };

    return (
        <Form
            layout="vertical"
            onFinish={handleSubmit(onSubmit)}
            style={{ maxWidth: 320, margin: "0 auto", marginTop: 64 }}
        >
            <Form.Item label="Enter Admin Password" required>
                <Controller
                    name="password"
                    control={control}
                    defaultValue=""
                    rules={{ required: "Password is required" }}
                    render={({ field }) => (
                        <Input.Password
                            {...field}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                        />
                    )}
                />
                {errors.password && (
                    <div style={{ color: "red", marginTop: 4 }}>{errors.password.message}</div>
                )}
            </Form.Item>
            <Form.Item>
                <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loginMutation.isPending} 
                    block
                    disabled={!isValid}
                >
                    Sign In
                </Button>
            </Form.Item>
        </Form>
    )
}