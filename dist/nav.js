/**
 * Navigation contributions for the vault feature pack.
 * These are automatically merged into the dashboard shell navigation.
 */
export const navContributions = [
    {
        id: 'vault',
        label: 'Vault',
        path: '/vault',
        icon: 'Lock',
        group: 'main',
        showWhen: 'authenticated',
        weight: 200,
        children: [
            {
                id: 'vault-personal',
                label: 'Personal',
                path: '/vault/personal',
                icon: 'User',
                weight: 100,
                showWhen: 'authenticated',
            },
            {
                id: 'vault-shared',
                label: 'Shared',
                path: '/vault/shared',
                icon: 'Users',
                weight: 110,
                showWhen: 'authenticated',
            },
        ],
    },
];
