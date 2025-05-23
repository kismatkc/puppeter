#!/bin/bash

# Log file setup
LOG_FILE="vm_creation_attempts.log"
touch $LOG_FILE
echo "Starting Oracle Cloud VM creation automation" | tee -a $LOG_FILE

# Values to be filled in manually
TENANCY_ID="ocid1.tenancy.oc1..aaaaaaaarjiqxi2pq5r35rhqhzhkgnrqvioalcvbovexxhxngkjnr4bqtk6q"
COMPARTMENT_ID="$TENANCY_ID"  # Same as Tenancy ID for root compartment
REGION="ca-toronto-1"  
AD_NAME="KZdJ:CA-TORONTO-1-AD-1"  
IMAGE_ID="ocid1.image.oc1.ca-toronto-1.aaaaaaaahvr57jcaq6w7qvjqerflbddz3ct7o54uwhfidraru52mged7mroq"
VCN_ID="ocid1.vcn.oc1.ca-toronto-1.amaaaaaajw66fqyaf2ely2fmpx4taqawfikrjwrpog2auolsdyssvz3pep4a"
SUBNET_ID="ocid1.subnet.oc1.ca-toronto-1.aaaaaaaavjjcsdkkd4o3habtclmc6jfrrg5udfz2ao4puoyutsvlp6cnsdaa"

# Generate new SSH key
SSH_DIR="$HOME/.ssh"
KEY_NAME="oci_key"
SSH_PUBLIC_KEY="$SSH_DIR/${KEY_NAME}.pub"
SSH_PRIVATE_KEY="$SSH_DIR/${KEY_NAME}"

if [[ ! -f "$SSH_PUBLIC_KEY" ]]; then
    echo "Generating SSH key..." | tee -a $LOG_FILE
    mkdir -p "$SSH_DIR"
    ssh-keygen -t rsa -b 2048 -f "$SSH_PRIVATE_KEY" -N ""
fi

echo "SSH public key: $SSH_PUBLIC_KEY" | tee -a $LOG_FILE

# Start VM creation attempts
echo "Starting VM creation retry loop..." | tee -a $LOG_FILE
ATTEMPT=1

while true; do
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    echo "[$TIMESTAMP] Attempt #$ATTEMPT - Trying to create VM..." | tee -a $LOG_FILE
    
    # Run the VM creation command
    VM_OUTPUT=$(oci compute instance launch \
        --compartment-id "$COMPARTMENT_ID" \
        --availability-domain "$AD_NAME" \
        --shape "VM.Standard.A1.Flex" \
        --shape-config '{"ocpus":4,"memoryInGBs":24}' \
        --display-name "AutoVM-$ATTEMPT" \
        --image-id "$IMAGE_ID" \
        --subnet-id "$SUBNET_ID" \
        --assign-public-ip true \
        --boot-volume-size-in-gbs 200 \
        --ssh-authorized-keys-file "$SSH_PUBLIC_KEY" 2>&1)
    
    # Check result
    if [[ $? -eq 0 ]]; then
        echo "[$TIMESTAMP] SUCCESS! VM created successfully!" | tee -a $LOG_FILE
        echo "$VM_OUTPUT" | tee -a $LOG_FILE
        
        # Extract instance ID
        INSTANCE_ID=$(echo "$VM_OUTPUT" | grep -o '"id": "[^"]*' | cut -d'"' -f4)
        echo "[$TIMESTAMP] Created instance ID: $INSTANCE_ID" | tee -a $LOG_FILE
        
        # Wait for VM to initialize
        echo "[$TIMESTAMP] Waiting for VM to initialize..." | tee -a $LOG_FILE
        sleep 60
        
        # Get public IP
        VNIC_INFO=$(oci compute instance list-vnics --instance-id "$INSTANCE_ID")
        PUBLIC_IP=$(echo "$VNIC_INFO" | grep -o '"public-ip": "[^"]*' | cut -d'"' -f4)
        echo "[$TIMESTAMP] Public IP: $PUBLIC_IP" | tee -a $LOG_FILE
        echo "[$TIMESTAMP] SSH command: ssh -i $SSH_PRIVATE_KEY ubuntu@$PUBLIC_IP" | tee -a $LOG_FILE
        
        # Notify success
        echo "VM CREATED SUCCESSFULLY!" | tee -a $LOG_FILE
        echo "SSH command: ssh -i $SSH_PRIVATE_KEY ubuntu@$PUBLIC_IP" | tee -a $LOG_FILE
        
        # Mac notification
        if [[ "$OSTYPE" == "darwin"* ]]; then
            osascript -e 'display notification "VM created successfully!" with title "Oracle Cloud VM" sound name "Glass"'
        fi
        
        break
    else
        echo "[$TIMESTAMP] FAILED: VM creation failed" | tee -a $LOG_FILE
        if [[ "$VM_OUTPUT" == *"Out of capacity"* ]]; then
            echo "[$TIMESTAMP] Out of capacity error detected" | tee -a $LOG_FILE
        fi
        echo "[$TIMESTAMP] Error details: $VM_OUTPUT" | tee -a $LOG_FILE
        echo "[$TIMESTAMP] Retrying in 60 seconds..." | tee -a $LOG_FILE
        ATTEMPT=$((ATTEMPT+1))
        sleep 60
    fi
done