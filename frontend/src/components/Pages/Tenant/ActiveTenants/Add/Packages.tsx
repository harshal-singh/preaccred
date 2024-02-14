import { Field, Text } from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';

type Props = {
  selectedTenant: ModelTypes['Tenant'] | undefined;
};

const Packages = ({ selectedTenant }: Props) => {
  return (
    <div className="flex flex-col gap-6 md:max-w-md">
      {selectedTenant?.packages ? (
        <>
          {selectedTenant.packages.map((p, i) => (
            <div key={p.package.id as string}>
              <Field
                label="Package:"
                className="font-semibold"
                orientation="horizontal"
              >
                <Text className="text-gray120" weight="regular">
                  {p.package.name}
                </Text>
              </Field>
              <Field
                label="Description:"
                className="font-semibold"
                orientation="horizontal"
              >
                <Text className="text-gray120" weight="regular">
                  {p.package.description}
                </Text>
              </Field>
              {/* <Field
                label="Roles:"
                className="font-semibold"
                orientation="horizontal"
              >
                <Text className="text-gray120" weight="regular">
                  {p.package.roles}
                </Text>
              </Field>
              <Field
                label="Objects:"
                className="font-semibold"
                orientation="horizontal"
              >
                <Text className="text-gray120" weight="regular">
                  {p.package.objects}
                </Text>
              </Field> */}
            </div>
          ))}
        </>
      ) : (
        'Please select a tenant first.'
      )}
    </div>
  );
};

export default Packages;
