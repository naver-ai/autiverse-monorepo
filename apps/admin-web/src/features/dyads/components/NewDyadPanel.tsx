import * as yup from 'yup'
import { useForm } from 'react-hook-form'
import { yupResolver } from "@hookform/resolvers/yup"
import { Button, Card, Form, Input, message, Select } from "antd"
import { FormItem } from '../../../components/react-hook-form-antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createDyadApi } from '../api'
import { ChildGender, DyadInfo, UserLocale, CaregiverType } from '@autiverse-monorepo/ts-core'

const schema = yup.object({
    alias: yup.string().required("Alias is required").trim(),
    caregiver_type: yup.mixed<CaregiverType>().required("Caregiver type is required"),
    child_gender: yup.mixed<ChildGender>().required("Child gender is required"),
    locale: yup.mixed<UserLocale>().required("Locale is required"),
    child_name: yup.string().required("Child name is required").min(1, "Child name must be at least 1 character").max(100, "Child name must be less than 100 characters").trim(),
    child_age: yup.number().required("Child age is required").min(0, "Child age must be greater than 0"),
}).required()

export const NewDyadPanel = () => {
    const queryClient = useQueryClient();
    const [messageApi, contextHolder] = message.useMessage();

    const { control, formState: {isValid}, handleSubmit, reset } = useForm({
        resolver: yupResolver(schema),
        defaultValues: { locale: UserLocale.Korean, child_age: 8 }
    })

    const createDyadMutation = useMutation({
        mutationFn: createDyadApi,
        onSuccess: () => {
            messageApi.success('Dyad created successfully');
            reset();
            queryClient.invalidateQueries({ queryKey: ['dyads'] });
        },
        onError: (error) => {
            messageApi.error('Failed to create dyad');
            console.error('Error creating dyad:', error);   
        }
    });

    const onSubmit = (data: DyadInfo) => {
        createDyadMutation.mutate(data);
    }

    return <Card size="small" title="Create Dyad" className="w-full shadow-md">
            {contextHolder}
            <Form onFinish={handleSubmit(onSubmit)}>
                <div className="flex flex-wrap items-center gap-4">
                <FormItem label="Alias" control={control} name="alias" className='m-0'>
                    <Input type="text" size="small" placeholder="Shown to researcher" />
                </FormItem>

                <FormItem label="Locale" control={control} name="locale" className='m-0'>
                    <Select options={Object.values(UserLocale).map(locale => ({ label: locale, value: locale }))} placeholder="Locale" popupMatchSelectWidth={false}/>
                </FormItem>
                <FormItem label="Caregiver Type" control={control} name="caregiver_type" className='m-0'>
                    <Select options={Object.values(CaregiverType).map(type => ({ label: type, value: type }))} placeholder="Type" popupMatchSelectWidth={false}/>
                </FormItem>
                <FormItem label="Child Gender" control={control} name="child_gender" className='m-0'>
                    <Select options={Object.values(ChildGender).map(gender => ({ label: gender, value: gender }))} placeholder="Gender" popupMatchSelectWidth={false}/>
                </FormItem>
                <FormItem label="Child Name" control={control} name="child_name" className='m-0'>
                    <Input type="text" size="small" placeholder="Child name" />
                </FormItem>
                <FormItem label="Child Age" control={control} name="child_age" className='m-0'>
                    <Input type="number" size="small" placeholder="Child age" />
                </FormItem>
                </div>
                <div className="flex justify-end">
                <Button 
                    type="primary" 
                    htmlType="submit" 
                    disabled={!isValid || createDyadMutation.isPending}
                    loading={createDyadMutation.isPending}
                    className='mt-4 self-end'
                >
                    Create Dyad
                </Button>
                </div>
            </Form>
        </Card>
}