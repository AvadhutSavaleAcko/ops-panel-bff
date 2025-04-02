import {fuelType, planType} from "../common/enums"

export interface ProposalSegmentFields {
    phone?: string | null;
    external_cng_kit?: boolean | null;
    registration_number?: string | null;
    user_pincode_journey?: string | null;
    make_name?: string | null;
    model_name?: string | null;
    variant_id?: string | null;
    variant_name?: string | null;
    engine_cc?: string | null;
    fuel_type?: fuelType | null;
    registration_year?: number | null;
    registration_month?: number | null;
    is_commercial?: boolean | null;
    chassis_number?: string | null;
    engine_number?: string | null;
    rto_zone?: string | null;
    is_expired?: boolean | null;
    previous_policy_type?: planType | null;
    previous_policy_expiry_bucket?: string | null;
    previous_insurer?: string | null;
    previous_policy_expiry_date?: string | null;
    previous_od_expiry_date?: string | null;
    previous_tp_expiry_date?: string | null;
    previous_ncb?: number | null;
    previous_idv?: number | null;
    last_year_claim_flag?: boolean | null;
    proposal_id?: string | null;
    last_claim_year?: Date | null;
    current_ncb?: number | null; 
    is_inspection_reqd?: boolean | null;
    user_name?: string | null;
    email?: string | null;
    pan_number?: string | null;
    journey_version?: string | null;
    logged_in?: boolean | null;
    asset_type?: string | null;
    //auto filled fields
    is_registration_number_autofilled?: boolean;
    is_make_autofilled?: boolean;
    is_model_autofilled?: boolean;
    is_variant_autofilled?: boolean;
    is_engine_number_autofilled?: boolean;
    is_chassis_number_autofilled?: boolean;
    is_registration_date_autofilled?: boolean;
    is_previous_policy_type_autofilled?: boolean;
    is_previous_policy_expiry_date_autofilled?: boolean;
    is_previous_insurer_autofilled?: boolean;
    is_previous_idv_autofilled?: boolean;
    is_previous_ncb_autofilled?: boolean;
    is_last_year_claim_flag_autofilled?: boolean;
    is_last_claim_year_autofilled?: boolean;
    is_phone_number_autofilled?: boolean;
    is_pincode_autofilled?: boolean;
    is_rc_name_autofilled?: boolean;
}
