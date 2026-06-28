-- DRAFT ONLY - DO NOT EXECUTE

-- Server-Side Tenant Context Contract for Customers and Services

-- 1. Helper function to get the current user's primary/active center.
CREATE OR REPLACE FUNCTION app_private.get_current_user_center_id()
RETURNS UUID AS $$
DECLARE
    v_center_id UUID;
BEGIN
    SELECT center_id INTO v_center_id
    FROM public.center_memberships
    WHERE profile_id = auth.uid() AND is_active = true
    LIMIT 1;
    
    IF v_center_id IS NULL THEN
        RAISE EXCEPTION 'User does not belong to any active center.';
    END IF;

    RETURN v_center_id;
END;
$$ LANGUAGE plpgsql STRICT STABLE SECURITY DEFINER SET search_path = public, auth;

-- Ensure execution permissions are revoked from public to avoid leakage.
REVOKE EXECUTE ON FUNCTION app_private.get_current_user_center_id() FROM public;
GRANT EXECUTE ON FUNCTION app_private.get_current_user_center_id() TO authenticated;

-- 2. Establish TRIGGER mechanisms
-- This enforces that even if a UI payload arbitrarily passes center_id 
-- it will be forcefully overridden by the server-side context.
CREATE OR REPLACE FUNCTION app_private.set_tenant_id_from_context()
RETURNS TRIGGER AS $$
BEGIN
    -- Force the tenant identity based on server-side resolution
    NEW.center_id := app_private.get_current_user_center_id();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Apply the trigger to Customers and Services BEFORE INSERT
DROP TRIGGER IF EXISTS tr_customers_set_tenant ON public.customers;
CREATE TRIGGER tr_customers_set_tenant
BEFORE INSERT ON public.customers
FOR EACH ROW
EXECUTE FUNCTION app_private.set_tenant_id_from_context();

DROP TRIGGER IF EXISTS tr_services_set_tenant ON public.services;
CREATE TRIGGER tr_services_set_tenant
BEFORE INSERT ON public.services
FOR EACH ROW
EXECUTE FUNCTION app_private.set_tenant_id_from_context();

-- 4. Restrict Updates to Prevent Tenant Reassignment
CREATE OR REPLACE FUNCTION app_private.prevent_tenant_reassignment()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.center_id IS DISTINCT FROM NEW.center_id THEN
        RAISE EXCEPTION 'Tenant reassignment is strictly prohibited.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_customers_prevent_tenant_reassignment ON public.customers;
CREATE TRIGGER tr_customers_prevent_tenant_reassignment
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION app_private.prevent_tenant_reassignment();

DROP TRIGGER IF EXISTS tr_services_prevent_tenant_reassignment ON public.services;
CREATE TRIGGER tr_services_prevent_tenant_reassignment
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION app_private.prevent_tenant_reassignment();

-- 5. LOCAL DATABASE EXECUTION NOT AVAILABLE
